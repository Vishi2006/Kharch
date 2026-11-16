package com.kharch.kharch_mobile

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    private val CHANNEL = "com.kharch.companion/bridge"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isNotificationListenerGranted" -> {
                    val packageName = context.packageName
                    val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
                    val isGranted = enabledPackages.contains(packageName)
                    result.success(isGranted)
                }

                "openNotificationSettings" -> {
                    try {
                        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        startActivity(intent)
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("ERROR", e.message, null)
                    }
                }

                "isBatteryOptimizationIgnored" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
                        val isIgnoring = pm.isIgnoringBatteryOptimizations(packageName)
                        result.success(isIgnoring)
                    } else {
                        result.success(true)
                    }
                }

                "requestBatteryOptimization" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                        try {
                            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                                data = Uri.parse("package:$packageName")
                                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            }
                            startActivity(intent)
                            result.success(true)
                        } catch (e: Exception) {
                            // Fallback to general battery settings
                            try {
                                val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                                startActivity(intent)
                                result.success(true)
                            } catch (fallbackEx: Exception) {
                                result.error("ERROR", fallbackEx.message, null)
                            }
                        }
                    } else {
                        result.success(true)
                    }
                }

                "saveServerConfig" -> {
                    val token = call.argument<String>("token")
                    val backendUrl = call.argument<String>("backendUrl")
                    val prefs = getSharedPreferences(KharchNotificationListenerService.PREFS_NAME, Context.MODE_PRIVATE)
                    prefs.edit().apply {
                        if (token != null) putString(KharchNotificationListenerService.KEY_AUTH_TOKEN, token)
                        if (backendUrl != null) putString(KharchNotificationListenerService.KEY_BACKEND_URL, backendUrl)
                        apply()
                    }
                    result.success(true)
                }

                else -> result.notImplemented()
            }
        }
    }
}
