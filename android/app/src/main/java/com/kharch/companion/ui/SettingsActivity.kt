package com.kharch.companion.ui

import android.content.Intent
import android.os.Bundle
import android.provider.Settings
import android.widget.Button
import android.widget.ImageButton
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.google.android.material.textfield.TextInputEditText
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions
import com.kharch.companion.R
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.network.ApiClient
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.sync.SyncManager
import com.kharch.companion.util.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONObject

class SettingsActivity : AppCompatActivity() {

    private lateinit var tvAllowlist: TextView
    private lateinit var tvPairingStatus: TextView
    private lateinit var etServerUrl: TextInputEditText
    private lateinit var etDeviceToken: TextInputEditText
    private lateinit var prefs: PreferenceManager
    private lateinit var db: KharchDatabase

    // QR scanner launcher using ScanContract
    private val qrScannerLauncher = registerForActivityResult(ScanContract()) { result ->
        if (result.contents != null) {
            handleScannedPayload(result.contents)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        prefs = PreferenceManager(this)
        db = KharchDatabase.getDatabase(this)

        tvAllowlist = findViewById(R.id.tvAllowedPackagesSummary)
        tvPairingStatus = findViewById(R.id.tvPairingStatus)
        etServerUrl = findViewById(R.id.etServerUrl)
        etDeviceToken = findViewById(R.id.etDeviceToken)

        etServerUrl.setText(prefs.serverUrl)
        if (!prefs.authToken.isNullOrEmpty()) {
            etDeviceToken.setText(prefs.authToken)
        }

        findViewById<ImageButton>(R.id.btnBack).setOnClickListener {
            finish()
        }

        findViewById<Button>(R.id.btnScanPairingQr).setOnClickListener {
            val options = ScanOptions().apply {
                setPrompt("Scan the Pairing QR code from Kharch PWA Settings")
                setBeepEnabled(true)
                setOrientationLocked(false)
            }
            qrScannerLauncher.launch(options)
        }

        findViewById<Button>(R.id.btnSaveToken).setOnClickListener {
            val token = etDeviceToken.text?.toString()?.trim() ?: ""
            if (token.isNotEmpty()) {
                prefs.authToken = token
                Toast.makeText(this, "Device token saved", Toast.LENGTH_SHORT).show()
                refreshPairingStatus()
                SyncManager.triggerImmediateSync(this)
            }
        }

        findViewById<Button>(R.id.btnSaveServerUrl).setOnClickListener {
            val url = etServerUrl.text?.toString()?.trim() ?: ""
            if (url.isNotEmpty()) {
                prefs.serverUrl = url
                Toast.makeText(this, "Server URL saved", Toast.LENGTH_SHORT).show()
            }
        }

        findViewById<Button>(R.id.btnEditAllowlist).setOnClickListener {
            val intent = Intent(this, ConsentActivity::class.java).apply {
                putExtra("IS_EDIT_MODE", true)
            }
            startActivity(intent)
        }

        findViewById<Button>(R.id.btnRevokeAccess).setOnClickListener {
            showRevokeConfirmationDialog()
        }
    }

    override fun onResume() {
        super.onResume()
        loadAllowlistSummary()
        refreshPairingStatus()
    }

    private fun handleScannedPayload(payload: String) {
        try {
            val json = JSONObject(payload)
            if (json.has("serverUrl")) {
                prefs.serverUrl = json.getString("serverUrl")
                etServerUrl.setText(prefs.serverUrl)
            }
            if (json.has("token")) {
                prefs.authToken = json.getString("token")
                etDeviceToken.setText(prefs.authToken)
            }
            Toast.makeText(this, "Paired successfully with PWA!", Toast.LENGTH_SHORT).show()
        } catch (_: Exception) {
            // If raw token string
            prefs.authToken = payload.trim()
            etDeviceToken.setText(prefs.authToken)
            Toast.makeText(this, "Token recorded", Toast.LENGTH_SHORT).show()
        }
        refreshPairingStatus()
        SyncManager.triggerImmediateSync(this)
    }

    private fun refreshPairingStatus() {
        if (!prefs.authToken.isNullOrEmpty()) {
            tvPairingStatus.text = "Status: ✓ Paired with Account"
            tvPairingStatus.setTextColor(getColor(R.color.success))
        } else {
            tvPairingStatus.text = "Status: ⚠️ Not Paired"
            tvPairingStatus.setTextColor(getColor(R.color.warning))
        }
    }

    private fun loadAllowlistSummary() {
        lifecycleScope.launch {
            val consent = withContext(Dispatchers.IO) {
                db.kharchDao().getConsent()
            }
            if (consent != null && consent.allowedPackages.isNotEmpty()) {
                val bulletList = consent.allowedPackages.joinToString("\n") { "• $it" }
                tvAllowlist.text = bulletList
            } else {
                tvAllowlist.text = "No applications configured in allowlist."
            }
        }
    }

    private fun showRevokeConfirmationDialog() {
        AlertDialog.Builder(this)
            .setTitle("Revoke Access & Delete Data?")
            .setMessage("This will stop the foreground listener, open system settings to turn off OS notification access, notify the backend to delete your companion records, and wipe local history.")
            .setPositiveButton("Revoke & Delete") { _, _ ->
                performRevoke()
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun performRevoke() {
        lifecycleScope.launch {
            // 1. Stop Foreground Service
            KharchForegroundService.stopService(this@SettingsActivity)

            // 2. Call DELETE /consent and DELETE /my-data on backend
            withContext(Dispatchers.IO) {
                ApiClient.revokeConsent(
                    serverUrl = prefs.serverUrl,
                    deviceId = prefs.deviceId,
                    token = prefs.authToken
                )
                ApiClient.deleteMyData(
                    serverUrl = prefs.serverUrl,
                    deviceId = prefs.deviceId,
                    token = prefs.authToken
                )

                // 3. Clear local Room tables and preferences
                db.kharchDao().clearConsent()
                db.kharchDao().clearAllNotificationEvents()
                db.kharchDao().clearSyncQueue()
            }

            prefs.authToken = null
            Toast.makeText(this@SettingsActivity, "Access revoked and local data cleared", Toast.LENGTH_LONG).show()

            // 4. Deep-link to Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS for OS-level revoke
            val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            startActivity(intent)

            // 5. Navigate back to Consent screen
            val consentIntent = Intent(this@SettingsActivity, ConsentActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
            }
            startActivity(consentIntent)
            finish()
        }
    }
}
