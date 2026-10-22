package com.kharch.companion

import android.app.Application
import com.kharch.companion.data.KharchDatabase

class KharchApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        // Pre-initialize Room Database
        KharchDatabase.getDatabase(this)
    }
}
