import 'package:flutter/services.dart';

class NativeBridge {
  static const MethodChannel _channel = MethodChannel('com.kharch.companion/bridge');

  /// Check whether the Notification Listener permission is granted
  static Future<bool> isNotificationListenerGranted() async {
    try {
      final bool? granted = await _channel.invokeMethod<bool>('isNotificationListenerGranted');
      return granted ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Launch Android Notification Access settings screen
  static Future<bool> openNotificationSettings() async {
    try {
      final bool? opened = await _channel.invokeMethod<bool>('openNotificationSettings');
      return opened ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Check whether battery optimization is ignored for Kharch
  static Future<bool> isBatteryOptimizationIgnored() async {
    try {
      final bool? ignored = await _channel.invokeMethod<bool>('isBatteryOptimizationIgnored');
      return ignored ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Request exemption from battery optimization
  static Future<bool> requestBatteryOptimization() async {
    try {
      final bool? res = await _channel.invokeMethod<bool>('requestBatteryOptimization');
      return res ?? false;
    } on PlatformException {
      return false;
    }
  }

  /// Store Bearer JWT and backend URL into Native SharedPreferences
  /// so background notification listener can sync even when Flutter is closed
  static Future<void> saveServerConfig(String token, String backendUrl) async {
    try {
      await _channel.invokeMethod('saveServerConfig', {
        'token': token,
        'backendUrl': backendUrl,
      });
    } on PlatformException {
      // Ignored on non-Android or if channel is unavailable
    }
  }
}
