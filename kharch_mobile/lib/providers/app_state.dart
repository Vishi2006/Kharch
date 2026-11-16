import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/native_bridge.dart';

class AppState extends ChangeNotifier {
  final ApiService _api = ApiService.instance;

  // Google OAuth Client IDs (Supporting Web App Client ID & fallback)
  static const String webClientId1 = '804504560516-0g5l1kbk9qr0lpgps8aq4t2ji7q3mkit.apps.googleusercontent.com';
  static const String webClientId2 = '804504560516-4bggeumofelo18bbn7stct4lnama7otn.apps.googleusercontent.com';

  GoogleSignIn _googleSignIn = GoogleSignIn(
    serverClientId: webClientId1,
    scopes: ['email', 'profile'],
  );

  bool _isInitialized = false;
  bool _isLoading = false;
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _spaces = [];
  Map<String, dynamic>? _activeSpace;
  Map<String, dynamic>? _dashboardData;
  Map<String, dynamic>? _inboxData;
  Map<String, dynamic>? _summaryData;
  Map<String, dynamic>? _analyticsData;
  bool _isAnalyticsLoading = false;

  // Background permission states
  bool _isNotificationListenerGranted = false;
  bool _isBatteryOptimizationIgnored = false;

  bool get isInitialized => _isInitialized;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _user != null && _api.token != null;
  Map<String, dynamic>? get user => _user;
  List<Map<String, dynamic>> get spaces => _spaces;
  Map<String, dynamic>? get activeSpace => _activeSpace;
  Map<String, dynamic>? get dashboardData => _dashboardData;
  Map<String, dynamic>? get inboxData => _inboxData;
  Map<String, dynamic>? get summaryData => _summaryData;
  Map<String, dynamic>? get analyticsData => _analyticsData;
  bool get isAnalyticsLoading => _isAnalyticsLoading;
  bool get isNotificationListenerGranted => _isNotificationListenerGranted;
  bool get isBatteryOptimizationIgnored => _isBatteryOptimizationIgnored;

  Future<void> init() async {
    _isLoading = true;
    notifyListeners();

    await _api.init();
    await checkNativePermissions();

    final prefs = await SharedPreferences.getInstance();
    final cachedUserJson = prefs.getString('cached_user');
    if (cachedUserJson != null) {
      try {
        _user = jsonDecode(cachedUserJson);
      } catch (_) {}
    }

    if (_api.token != null) {
      await fetchUserData();
    }

    _isInitialized = true;
    _isLoading = false;
    notifyListeners();
  }

  Future<void> checkNativePermissions() async {
    _isNotificationListenerGranted = await NativeBridge.isNotificationListenerGranted();
    _isBatteryOptimizationIgnored = await NativeBridge.isBatteryOptimizationIgnored();
    notifyListeners();
  }

  Future<void> openNotificationSettings() async {
    await NativeBridge.openNotificationSettings();
    await Future.delayed(const Duration(seconds: 1));
    await checkNativePermissions();
  }

  Future<void> requestBatteryOptimization() async {
    await NativeBridge.requestBatteryOptimization();
    await Future.delayed(const Duration(seconds: 1));
    await checkNativePermissions();
  }

  /// Trigger Native / Web Google Sign-In with automatic client ID and fallback resolution
  Future<Map<String, dynamic>> signInWithGoogle() async {
    _isLoading = true;
    notifyListeners();

    final clientIdsToTry = [
      const String.fromEnvironment('GOOGLE_CLIENT_ID', defaultValue: webClientId1),
      webClientId2,
      null, // null attempts native Android sign-in without serverClientId
    ];

    Object? lastError;

    for (final cid in clientIdsToTry) {
      try {
        _googleSignIn = GoogleSignIn(
          serverClientId: cid,
          scopes: ['email', 'profile'],
        );

        try {
          await _googleSignIn.signOut();
        } catch (_) {}

        final GoogleSignInAccount? account = await _googleSignIn.signIn();
        if (account == null) {
          _isLoading = false;
          notifyListeners();
          return {'success': false, 'error': 'Sign-in cancelled'};
        }

        final GoogleSignInAuthentication auth = await account.authentication;
        final String? tokenToSend = auth.idToken ?? auth.accessToken;

        if (tokenToSend == null) {
          continue;
        }

        // Send Google credential to backend API
        final res = await _api.post('/api/auth/google', {'credential': tokenToSend});

        if (res['token'] != null) {
          final token = res['token'] as String;
          await _api.setToken(token);

          if (res['user'] != null) {
            _user = Map<String, dynamic>.from(res['user']);
            final prefs = await SharedPreferences.getInstance();
            await prefs.setString('cached_user', jsonEncode(_user));
          }

          await fetchUserData();
          _isLoading = false;
          notifyListeners();
          return {'success': true};
        }

        if (res['error'] != null) {
          _isLoading = false;
          notifyListeners();
          return {'success': false, 'error': res['error']};
        }
      } catch (e) {
        lastError = e;
        final errStr = e.toString();
        if (errStr.contains('sign_in_canceled') || errStr.contains('canceled')) {
          _isLoading = false;
          notifyListeners();
          return {'success': false, 'error': 'Sign-in cancelled'};
        }
        // If error occurred with this client ID, loop to try next
        continue;
      }
    }

    _isLoading = false;
    notifyListeners();

    final errString = lastError?.toString() ?? 'Unknown error';
    final isApi10 = errString.contains('ApiException: 10') || errString.contains('DEVELOPER_ERROR');

    return {
      'success': false,
      'isApi10': isApi10,
      'error': isApi10
          ? 'Google Sign-in failed (ApiException: 10). Missing SHA-1 in Google Cloud Console.'
          : 'Google Sign-in failed: $errString',
    };
  }

  Future<void> logout() async {
    try {
      await _googleSignIn.signOut();
      await _api.post('/api/auth/logout', {});
    } catch (_) {}

    await _api.setToken(null);
    _user = null;
    _spaces = [];
    _activeSpace = null;
    _dashboardData = null;
    _inboxData = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('cached_user');
    notifyListeners();
  }

  Future<void> fetchUserData() async {
    final meRes = await _api.get('/api/auth/me');
    if (meRes['user'] != null) {
      _user = Map<String, dynamic>.from(meRes['user']);
    }

    await fetchSpaces();

    if (_activeSpace == null && _spaces.isNotEmpty) {
      final defaultSpaceId = meRes['defaultSpaceId'];
      _activeSpace = _spaces.firstWhere(
        (s) => s['_id'] == defaultSpaceId,
        orElse: () => _spaces.first,
      );
    }

    if (_activeSpace != null) {
      await refreshDashboard();
      await refreshInbox();
    }
    notifyListeners();
  }

  Future<void> fetchSpaces() async {
    final res = await _api.get('/api/spaces');
    if (res['data'] is List) {
      _spaces = List<Map<String, dynamic>>.from(res['data']);
    } else if (res['spaces'] is List) {
      _spaces = List<Map<String, dynamic>>.from(res['spaces']);
    }

    if (_activeSpace != null) {
      final match = _spaces.where((s) => s['_id'] == _activeSpace!['_id']).toList();
      if (match.isNotEmpty) {
        _activeSpace = match.first;
      }
    }
    notifyListeners();
  }

  void switchSpace(Map<String, dynamic> space) {
    _activeSpace = space;
    notifyListeners();
    refreshDashboard();
    refreshSummary();
  }

  Future<bool> createSpace(String name) async {
    final res = await _api.post('/api/spaces', {'name': name});
    if (res['error'] == null) {
      await fetchSpaces();
      return true;
    }
    return false;
  }

  Future<bool> renameSpace(String spaceId, String newName) async {
    final res = await _api.put('/api/spaces/$spaceId', {'name': newName});
    if (res['error'] == null) {
      await fetchSpaces();
      return true;
    }
    return false;
  }

  Future<bool> deleteSpace(String spaceId) async {
    final res = await _api.delete('/api/spaces/$spaceId');
    if (res['error'] == null) {
      await fetchSpaces();
      if (_activeSpace?['_id'] == spaceId && _spaces.isNotEmpty) {
        _activeSpace = _spaces.first;
        await refreshDashboard();
      }
      return true;
    }
    return false;
  }

  Future<void> refreshDashboard() async {
    if (_activeSpace == null) return;
    final spaceId = _activeSpace!['_id'];
    const tz = 'UTC';

    final res = await _api.get('/api/transactions/dashboard?spaceId=$spaceId&timezone=$tz');
    if (res['error'] == null) {
      _dashboardData = res;
      notifyListeners();
    }
  }

  Future<void> fetchAnalytics([String period = 'month']) async {
    if (_activeSpace == null) return;
    _isAnalyticsLoading = true;
    notifyListeners();

    final spaceId = _activeSpace!['_id'];
    final res = await _api.get('/api/transactions/analytics?spaceId=$spaceId&period=$period&timezone=UTC');
    if (res['error'] == null) {
      _analyticsData = res;
    }
    _isAnalyticsLoading = false;
    notifyListeners();
  }

  Future<bool> addTransaction({
    required double amount,
    required String title,
    required String type,
    String? importance,
    String? date,
  }) async {
    if (_activeSpace == null) return false;

    final body = {
      'spaceId': _activeSpace!['_id'],
      'amount': amount,
      'title': title,
      'type': type,
      'importance': type == 'expense' ? (importance ?? 'essential') : null,
      'date': date ?? DateTime.now().toIso8601String(),
    };

    final res = await _api.post('/api/transactions', body);
    if (res['error'] == null) {
      await refreshDashboard();
      return true;
    }
    return false;
  }

  Future<void> refreshInbox() async {
    final res = await _api.get('/api/inbox');
    if (res['error'] == null) {
      _inboxData = res;
      notifyListeners();
    }
  }

  Future<bool> acceptInboxMatch({
    required String eventId,
    required String attemptId,
    required String title,
    required String importance,
  }) async {
    if (_activeSpace == null) return false;

    final res = await _api.post('/api/inbox/accept-match', {
      'eventId': eventId,
      'attemptId': attemptId,
      'spaceId': _activeSpace!['_id'],
      'title': title,
      'importance': importance,
    });

    if (res['error'] == null) {
      await refreshInbox();
      await refreshDashboard();
      return true;
    }
    return false;
  }

  Future<bool> convertInboxItem({
    required String itemId,
    required String itemType,
    required String title,
    required String importance,
  }) async {
    if (_activeSpace == null) return false;

    final res = await _api.post('/api/inbox/convert', {
      'itemId': itemId,
      'itemType': itemType,
      'spaceId': _activeSpace!['_id'],
      'title': title,
      'importance': importance,
    });

    if (res['error'] == null) {
      await refreshInbox();
      await refreshDashboard();
      return true;
    }
    return false;
  }

  Future<bool> dismissInboxItem(String itemId, String itemType) async {
    final res = await _api.post('/api/inbox/dismiss', {
      'itemId': itemId,
      'itemType': itemType,
    });

    if (res['error'] == null) {
      await refreshInbox();
      return true;
    }
    return false;
  }

  Future<void> refreshSummary() async {
    if (_activeSpace == null) return;
    final now = DateTime.now();
    final monthStr = '${now.year}-${now.month.toString().padLeft(2, '0')}';
    final spaceId = _activeSpace!['_id'];

    final res = await _api.get('/api/summaries/current?spaceId=$spaceId&month=$monthStr');
    if (res['error'] == null) {
      _summaryData = res;
      notifyListeners();
    }
  }

  Future<bool> setOpeningBalance(double amount) async {
    if (_activeSpace == null) return false;
    final now = DateTime.now();
    final monthStr = '${now.year}-${now.month.toString().padLeft(2, '0')}';

    final res = await _api.post('/api/summaries/opening', {
      'spaceId': _activeSpace!['_id'],
      'month': monthStr,
      'amount': amount,
    });

    if (res['error'] == null) {
      await refreshDashboard();
      await refreshSummary();
      return true;
    }
    return false;
  }

  Future<bool> finalizeClosingBalance(double amount) async {
    if (_activeSpace == null) return false;
    final now = DateTime.now();
    final monthStr = '${now.year}-${now.month.toString().padLeft(2, '0')}';

    final res = await _api.post('/api/closing', {
      'spaceId': _activeSpace!['_id'],
      'month': monthStr,
      'amount': amount,
      'isLocked': true,
    });

    if (res['error'] == null) {
      await refreshDashboard();
      await refreshSummary();
      return true;
    }
    return false;
  }
}
