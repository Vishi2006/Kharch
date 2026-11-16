import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';
import '../services/native_bridge.dart';

class AppState extends ChangeNotifier {
  final ApiService _api = ApiService.instance;

  bool _isInitialized = false;
  bool _isLoading = false;
  Map<String, dynamic>? _user;
  List<Map<String, dynamic>> _spaces = [];
  Map<String, dynamic>? _activeSpace;
  Map<String, dynamic>? _dashboardData;
  Map<String, dynamic>? _inboxData;
  Map<String, dynamic>? _summaryData;

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

  Future<bool> login(String credential) async {
    _isLoading = true;
    notifyListeners();

    final res = await _api.post('/api/auth/google', {'credential': credential});
    _isLoading = false;

    if (res['token'] != null && res['user'] != null) {
      final token = res['token'] as String;
      await _api.setToken(token);
      _user = Map<String, dynamic>.from(res['user']);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_user', jsonEncode(_user));

      await fetchUserData();
      notifyListeners();
      return true;
    }

    // Graceful offline fallback for Demo Mode or initial server setup
    if (credential.startsWith('mock_token_')) {
      final email = credential.replaceFirst('mock_token_', '');
      final name = email.split('@').first.toUpperCase();
      _user = {
        'id': 'arcade_pilot_1',
        'email': email,
        'name': name,
      };
      _spaces = [
        {'_id': 'vault_1', 'name': 'Personal Life', 'isDefault': true},
        {'_id': 'vault_2', 'name': 'Business Vault', 'isDefault': false},
      ];
      _activeSpace = _spaces.first;
      _dashboardData = {
        'netBalance': 24500.0,
        'monthlyExpense': 12350.0,
        'monthlyIncome': 36850.0,
        'recentTransactions': [
          {
            'amount': 250.0,
            'title': 'Cold Brew & Croissant',
            'type': 'expense',
            'importance': 'moderate',
            'date': DateTime.now().toIso8601String(),
          },
          {
            'amount': 1200.0,
            'title': 'Metro & Taxi Transit',
            'type': 'expense',
            'importance': 'essential',
            'date': DateTime.now().subtract(const Duration(hours: 4)).toIso8601String(),
          },
          {
            'amount': 35000.0,
            'title': 'Consulting Payout',
            'type': 'income',
            'date': DateTime.now().subtract(const Duration(days: 1)).toIso8601String(),
          },
        ],
      };
      _inboxData = {
        'mediumMatches': [],
        'unmatchedEvents': [],
        'unknownAttempts': [],
        'unreadCount': 0,
      };
      _summaryData = {
        'openingBalance': 10000.0,
        'calculatedClosingBalance': 24500.0,
        'actualClosingBalance': null,
        'isLocked': false,
      };

      await _api.setToken('offline_arcade_token');
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('cached_user', jsonEncode(_user));
      notifyListeners();
      return true;
    }

    notifyListeners();
    return false;
  }

  Future<void> logout() async {
    try {
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
    // 1. Fetch current user & default space
    final meRes = await _api.get('/api/auth/me');
    if (meRes['user'] != null) {
      _user = Map<String, dynamic>.from(meRes['user']);
    }

    // 2. Fetch spaces
    await fetchSpaces();

    // 3. Set active space if none selected
    if (_activeSpace == null && _spaces.isNotEmpty) {
      final defaultSpaceId = meRes['defaultSpaceId'];
      _activeSpace = _spaces.firstWhere(
        (s) => s['_id'] == defaultSpaceId,
        orElse: () => _spaces.first,
      );
    }

    // 4. Load dashboard & inbox
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
    // Offline local creation
    final newSp = {'_id': 'sp_${DateTime.now().millisecondsSinceEpoch}', 'name': name};
    _spaces.add(newSp);
    notifyListeners();
    return true;
  }

  Future<bool> renameSpace(String spaceId, String newName) async {
    final res = await _api.put('/api/spaces/$spaceId', {'name': newName});
    if (res['error'] == null) {
      await fetchSpaces();
      return true;
    }
    final idx = _spaces.indexWhere((s) => s['_id'] == spaceId);
    if (idx != -1) {
      _spaces[idx]['name'] = newName;
      notifyListeners();
    }
    return true;
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
    _spaces.removeWhere((s) => s['_id'] == spaceId);
    if (_activeSpace?['_id'] == spaceId && _spaces.isNotEmpty) {
      _activeSpace = _spaces.first;
    }
    notifyListeners();
    return true;
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

    // Local state append so UI updates immediately
    if (_dashboardData != null) {
      final currentTx = List<Map<String, dynamic>>.from(
        _dashboardData!['recentTransactions'] ?? [],
      );
      currentTx.insert(0, {
        'amount': amount,
        'title': title,
        'type': type,
        'importance': importance ?? 'essential',
        'date': date ?? DateTime.now().toIso8601String(),
      });
      final currentBal = (_dashboardData!['netBalance'] ?? 0.0) as double;
      final newBal = type == 'income' ? currentBal + amount : currentBal - amount;

      _dashboardData!['recentTransactions'] = currentTx;
      _dashboardData!['netBalance'] = newBal;
      notifyListeners();
    }
    return true;
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
