package com.kharch.companion.receiver

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.util.PreferenceManager

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_BOOT_COMPLETED || action == Intent.ACTION_MY_PACKAGE_REPLACED) {
            val isNotifGranted = NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)
            val prefs = PreferenceManager(context)
            if (isNotifGranted && prefs.isForegroundServiceEnabled) {
                KharchForegroundService.startService(context)
            }
        }
    }
}
