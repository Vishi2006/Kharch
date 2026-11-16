import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'native_bridge.dart';

class ApiService {
  static const String _defaultBaseUrl = 'https://kharch2026.vercel.app';
  static const String _keyBaseUrl = 'kharch_api_base_url';
  static const String _keyToken = 'kharch_auth_token';

  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String _baseUrl = _defaultBaseUrl;
  String? _token;

  static final ApiService instance = ApiService._internal();
  ApiService._internal();

  String get baseUrl => _baseUrl;
  String? get token => _token;

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    _baseUrl = prefs.getString(_keyBaseUrl) ?? _defaultBaseUrl;
    _token = await _storage.read(key: _keyToken);

    if (_token != null) {
      await NativeBridge.saveServerConfig(_token!, _baseUrl);
    }
  }

  Future<void> setBaseUrl(String url) async {
    _baseUrl = url.trim().replaceAll(RegExp(r'/+$'), '');
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyBaseUrl, _baseUrl);
    if (_token != null) {
      await NativeBridge.saveServerConfig(_token!, _baseUrl);
    }
  }

  Future<void> setToken(String? token) async {
    _token = token;
    if (token == null) {
      await _storage.delete(key: _keyToken);
      await NativeBridge.saveServerConfig('', _baseUrl);
    } else {
      await _storage.write(key: _keyToken, value: token);
      await NativeBridge.saveServerConfig(token, _baseUrl);
    }
  }

  Map<String, String> _buildHeaders() {
    final headers = <String, String>{
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (_token != null && _token!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $_token';
    }
    return headers;
  }

  Future<Map<String, dynamic>> get(String endpoint) async {
    final uri = Uri.parse('$_baseUrl$endpoint');
    try {
      final response = await http
          .get(uri, headers: _buildHeaders())
          .timeout(const Duration(seconds: 25));
      return _processResponse(response);
    } catch (e) {
      return {'error': 'Network error: ${e.toString()}', 'status': 500};
    }
  }

  Future<Map<String, dynamic>> post(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('$_baseUrl$endpoint');
    try {
      final response = await http
          .post(uri, headers: _buildHeaders(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 25));
      return _processResponse(response);
    } catch (e) {
      return {'error': 'Network error: ${e.toString()}', 'status': 500};
    }
  }

  Future<Map<String, dynamic>> put(String endpoint, Map<String, dynamic> body) async {
    final uri = Uri.parse('$_baseUrl$endpoint');
    try {
      final response = await http
          .put(uri, headers: _buildHeaders(), body: jsonEncode(body))
          .timeout(const Duration(seconds: 25));
      return _processResponse(response);
    } catch (e) {
      return {'error': 'Network error: ${e.toString()}', 'status': 500};
    }
  }

  Future<Map<String, dynamic>> delete(String endpoint) async {
    final uri = Uri.parse('$_baseUrl$endpoint');
    try {
      final response = await http
          .delete(uri, headers: _buildHeaders())
          .timeout(const Duration(seconds: 25));
      return _processResponse(response);
    } catch (e) {
      return {'error': 'Network error: ${e.toString()}', 'status': 500};
    }
  }

  Map<String, dynamic> _processResponse(http.Response response) {
    try {
      final decoded = jsonDecode(response.body);
      if (response.statusCode >= 200 && response.statusCode < 300) {
        if (decoded is Map<String, dynamic>) {
          return decoded;
        } else if (decoded is List) {
          return {'data': decoded, 'status': response.statusCode};
        }
        return {'success': true, 'status': response.statusCode};
      }
      final msg = decoded is Map && decoded['message'] != null
          ? decoded['message']
          : 'Request failed (${response.statusCode})';
      return {'error': msg, 'status': response.statusCode};
    } catch (e) {
      if (response.statusCode >= 200 && response.statusCode < 300) {
        return {'success': true, 'status': response.statusCode};
      }
      return {'error': 'Invalid server response', 'status': response.statusCode};
    }
  }
}
