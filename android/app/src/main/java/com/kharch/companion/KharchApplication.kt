package com.kharch.companion

import android.app.Application
import androidx.core.app.NotificationManagerCompat
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.sync.SyncManager
import com.kharch.companion.util.PreferenceManager

class KharchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Pre-initialize Room Database
        KharchDatabase.getDatabase(this)

        // Setup background sync triggers
        SyncManager.schedulePeriodicSync(this)
        SyncManager.registerNetworkCallback(this)

        // Auto-start persistent foreground listener if notification access is granted
        val isNotifGranted = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        val prefs = PreferenceManager(this)
        if (isNotifGranted && prefs.isForegroundServiceEnabled) {
            KharchForegroundService.startService(this)
        }
    }
}
