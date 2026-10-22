package com.kharch.companion.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView
import com.kharch.companion.R
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.util.OemHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.util.concurrent.TimeUnit

class MainActivity : AppCompatActivity() {

    private lateinit var tvLastCaptured: TextView
    private lateinit var tvTotalEvents: TextView
    private lateinit var tvPendingSync: TextView
    private lateinit var btnSyncNow: Button
    private lateinit var tvNotifStatus: TextView
    private lateinit var tvBatteryStatus: TextView
    private lateinit var tvServiceStatus: TextView
    private lateinit var btnFixNotif: Button
    private lateinit var btnFixBattery: Button
    private lateinit var btnToggleService: Button
    private lateinit var cardWarning: MaterialCardView
    private lateinit var tvWarningMessage: TextView
    private lateinit var btnRecheck: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvLastCaptured = findViewById(R.id.tvLastCapturedTime)
        tvTotalEvents = findViewById(R.id.tvTotalEventsCaptured)
        tvPendingSync = findViewById(R.id.tvPendingSyncCount)
        btnSyncNow = findViewById(R.id.btnSyncNow)
        tvNotifStatus = findViewById(R.id.tvNotificationAccessStatus)
        tvBatteryStatus = findViewById(R.id.tvBatteryOptimizationStatus)
        tvServiceStatus = findViewById(R.id.tvForegroundServiceStatus)
        btnFixNotif = findViewById(R.id.btnFixNotificationAccess)
        btnFixBattery = findViewById(R.id.btnFixBatteryOptimization)
        btnToggleService = findViewById(R.id.btnToggleForegroundService)
        cardWarning = findViewById(R.id.cardWarningBanner)
        tvWarningMessage = findViewById(R.id.tvWarningMessage)
        btnRecheck = findViewById(R.id.btnRecheckPermissions)

        findViewById<ImageButton>(R.id.btnOpenSettings).setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }

        findViewById<Button>(R.id.btnRerunOemWizard).setOnClickListener {
            startActivity(Intent(this, OemWizardActivity::class.java))
        }

        btnFixNotif.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        btnFixBattery.setOnClickListener {
            OemHelper.requestIgnoreBatteryOptimization(this)
        }

        btnToggleService.setOnClickListener {
            if (KharchForegroundService.isRunning) {
                KharchForegroundService.stopService(this)
            } else {
                KharchForegroundService.startService(this)
            }
            refreshHealthStatus()
        }

        btnRecheck.setOnClickListener {
            val isNotifGranted = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
            val isBatteryIgnored = OemHelper.isBatteryOptimizationIgnored(this)

            if (!isNotifGranted) {
                startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            } else if (!isBatteryIgnored) {
                OemHelper.requestIgnoreBatteryOptimization(this)
            } else if (!KharchForegroundService.isRunning) {
                KharchForegroundService.startService(this)
            }
            refreshHealthStatus()
        }

        btnSyncNow.setOnClickListener {
            com.kharch.companion.sync.SyncManager.triggerImmediateSync(this)
            android.widget.Toast.makeText(this, "Sync triggered", android.widget.Toast.LENGTH_SHORT).show()
            refreshHealthStatus()
        }
    }

    override fun onResume() {
        super.onResume()
        com.kharch.companion.sync.SyncManager.triggerImmediateSync(this)
        refreshHealthStatus()
    }

    private fun refreshHealthStatus() {
        // 1. Check Notification Access
        val isNotifGranted = NotificationManagerCompat.getEnabledListenerPackages(this).contains(packageName)
        if (isNotifGranted) {
            tvNotifStatus.text = "✓ Access Granted"
            tvNotifStatus.setTextColor(getColor(R.color.success))
            btnFixNotif.visibility = View.GONE
        } else {
            tvNotifStatus.text = "✗ Access Revoked / Missing"
            tvNotifStatus.setTextColor(getColor(R.color.danger))
            btnFixNotif.visibility = View.VISIBLE
            btnFixNotif.text = "Grant"
        }

        // 2. Check Battery Optimization
        val isBatteryIgnored = OemHelper.isBatteryOptimizationIgnored(this)
        if (isBatteryIgnored) {
            tvBatteryStatus.text = "✓ Exempted (Unrestricted)"
            tvBatteryStatus.setTextColor(getColor(R.color.success))
            btnFixBattery.visibility = View.GONE
        } else {
            tvBatteryStatus.text = "✗ Restricted by OS"
            tvBatteryStatus.setTextColor(getColor(R.color.warning))
            btnFixBattery.visibility = View.VISIBLE
            btnFixBattery.text = "Exempt"
        }

        // 3. Check Foreground Service
        val isServiceRunning = KharchForegroundService.isRunning
        if (isServiceRunning) {
            tvServiceStatus.text = "✓ Running (Active)"
            tvServiceStatus.setTextColor(getColor(R.color.success))
            btnToggleService.text = "Stop"
        } else {
            tvServiceStatus.text = "✗ Stopped"
            tvServiceStatus.setTextColor(getColor(R.color.text_muted))
            btnToggleService.text = "Start"
        }

        // Database queries for last captured notification
        val db = KharchDatabase.getDatabase(this)
        lifecycleScope.launch {
            val lastEvent = withContext(Dispatchers.IO) {
                db.kharchDao().getLastNotificationEvent()
            }
            val totalCount = withContext(Dispatchers.IO) {
                db.kharchDao().getTotalNotificationCount()
            }
            val pendingCount = withContext(Dispatchers.IO) {
                db.kharchDao().getPendingSyncCount()
            }

            tvTotalEvents.text = "Total events logged: $totalCount"
            tvPendingSync.text = "Pending sync: $pendingCount items"

            var hoursSinceLast: Long = -1
            if (lastEvent != null) {
                val diffMs = System.currentTimeMillis() - lastEvent.timestamp
                val minutes = TimeUnit.MILLISECONDS.toMinutes(diffMs)
                hoursSinceLast = TimeUnit.MILLISECONDS.toHours(diffMs)

                val timeStr = when {
                    minutes < 1 -> "Just now"
                    minutes < 60 -> "$minutes min ago"
                    hoursSinceLast < 24 -> "$hoursSinceLast hours ago"
                    else -> "${TimeUnit.MILLISECONDS.toDays(diffMs)} days ago"
                }
                tvLastCaptured.text = "Last notification captured: $timeStr (${lastEvent.sourceApp})"
            } else {
                tvLastCaptured.text = "Last notification captured: None recorded yet"
            }

            // Warning Banner check (2f requirement)
            val hasPermissionRevoked = !isNotifGranted || !isBatteryIgnored || !isServiceRunning
            val isStaleCapture = (hoursSinceLast > 12) && totalCount > 0

            if (hasPermissionRevoked) {
                cardWarning.visibility = View.VISIBLE
                tvWarningMessage.text = "Attention: One or more background permissions or services are disabled. Notifications may not be received."
            } else if (isStaleCapture) {
                cardWarning.visibility = View.VISIBLE
                tvWarningMessage.text = "No notifications captured in over $hoursSinceLast hours despite expected activity. Re-verify OEM battery permissions."
            } else {
                cardWarning.visibility = View.GONE
            }
        }
    }
}
