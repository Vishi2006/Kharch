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
import com.kharch.companion.R
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.network.ApiClient
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.util.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class SettingsActivity : AppCompatActivity() {

    private lateinit var tvAllowlist: TextView
    private lateinit var etServerUrl: TextInputEditText
    private lateinit var prefs: PreferenceManager
    private lateinit var db: KharchDatabase

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)

        prefs = PreferenceManager(this)
        db = KharchDatabase.getDatabase(this)

        tvAllowlist = findViewById(R.id.tvAllowedPackagesSummary)
        etServerUrl = findViewById(R.id.etServerUrl)

        etServerUrl.setText(prefs.serverUrl)

        findViewById<ImageButton>(R.id.btnBack).setOnClickListener {
            finish()
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

                // 3. Clear local Room tables
                db.kharchDao().clearConsent()
                db.kharchDao().clearAllNotificationEvents()
                db.kharchDao().clearSyncQueue()
            }

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
