package com.kharch.companion

import android.app.Application
import com.kharch.companion.data.KharchDatabase

class KharchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Pre-initialize Room Database
        KharchDatabase.getDatabase(this)

        // Phase 3: Setup background sync triggers
        com.kharch.companion.sync.SyncManager.schedulePeriodicSync(this)
        com.kharch.companion.sync.SyncManager.registerNetworkCallback(this)
    }
}
