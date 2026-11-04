package com.kharch.companion.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.View
import android.widget.Button
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationManagerCompat
import androidx.lifecycle.lifecycleScope
import com.google.android.material.card.MaterialCardView
import com.google.android.material.textfield.TextInputEditText
import com.kharch.companion.R
import com.kharch.companion.data.ConsentRecord
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.network.ApiClient
import com.kharch.companion.util.PreferenceManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class ConsentActivity : AppCompatActivity() {

    private val customPackages = mutableListOf<String>()

    // Restricted Settings unlock flow views (Android 13+)
    private lateinit var cardRestrictedSteps: MaterialCardView
    private lateinit var tvStep2Hint: TextView
    private lateinit var tvStepsComplete: TextView
    private lateinit var btnStep1: Button
    private lateinit var btnStep2: Button
    private lateinit var btnStep3: Button

    // Track whether consent was saved so onResume can check listener status
    private var consentSaved = false
    private var isEditMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_consent)

        isEditMode = intent.getBooleanExtra("IS_EDIT_MODE", false)

        val cbPhonePe       = findViewById<CheckBox>(R.id.cbPhonePe)
        val cbGPay          = findViewById<CheckBox>(R.id.cbGPay)
        val cbPaytm         = findViewById<CheckBox>(R.id.cbPaytm)
        val cbBhim          = findViewById<CheckBox>(R.id.cbBhim)
        val etCustomPackage = findViewById<TextInputEditText>(R.id.etCustomPackage)
        val btnAddPackage   = findViewById<Button>(R.id.btnAddPackage)
        val containerCustom = findViewById<LinearLayout>(R.id.containerCustomPackages)
        val btnConfirm      = findViewById<Button>(R.id.btnConfirmConsent)

        // Restricted Settings card views
        cardRestrictedSteps = findViewById(R.id.cardRestrictedSteps)
        tvStep2Hint         = findViewById(R.id.tvStep2Hint)
        tvStepsComplete     = findViewById(R.id.tvStepsComplete)
        btnStep1            = findViewById(R.id.btnStep1)
        btnStep2            = findViewById(R.id.btnStep2)
        btnStep3            = findViewById(R.id.btnStep3)

        // Set the manufacturer-aware hint for Step 2
        tvStep2Hint.text = buildStep2Hint()

        // Wire Step buttons
        btnStep1.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }
        btnStep2.setOnClickListener {
            // Open App Info so the user can find "Allow restricted settings"
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
            startActivity(intent)
        }
        btnStep3.setOnClickListener {
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        val db    = KharchDatabase.getDatabase(this)
        val prefs = PreferenceManager(this)

        lifecycleScope.launch {
            val existingConsent = withContext(Dispatchers.IO) {
                db.kharchDao().getConsent()
            }

            if (!isEditMode && existingConsent != null && existingConsent.allowedPackages.isNotEmpty()) {
                // Already consented — check if listener is enabled before skipping
                val listenerEnabled = NotificationManagerCompat
                    .getEnabledListenerPackages(this@ConsentActivity)
                    .contains(packageName)

                if (listenerEnabled) {
                    startActivity(Intent(this@ConsentActivity, MainActivity::class.java))
                    finish()
                    return@launch
                }
                // Listener NOT enabled yet — show restricted steps immediately
                consentSaved = true
                showRestrictedStepsIfNeeded()
                return@launch
            }

            // Reflect existing consent in checkboxes
            if (existingConsent != null) {
                val list = existingConsent.allowedPackages
                cbPhonePe.isChecked = list.contains("com.phonepe.app")
                cbGPay.isChecked    = list.contains("com.google.android.apps.nbu.paisa.user")
                cbPaytm.isChecked   = list.contains("net.one97.paytm")
                cbBhim.isChecked    = list.contains("in.org.npci.upiapp")

                val defaultPkgs = setOf(
                    "com.phonepe.app",
                    "com.google.android.apps.nbu.paisa.user",
                    "net.one97.paytm",
                    "in.org.npci.upiapp"
                )
                list.filter { !defaultPkgs.contains(it) }.forEach { customPkg ->
                    addCustomPackageView(customPkg, containerCustom)
                }
            }
        }

        btnAddPackage.setOnClickListener {
            val pkg = etCustomPackage.text?.toString()?.trim() ?: ""
            if (pkg.isNotEmpty() && !customPackages.contains(pkg)) {
                addCustomPackageView(pkg, containerCustom)
                etCustomPackage.text?.clear()
            } else if (pkg.isEmpty()) {
                Toast.makeText(this, "Enter a valid package name", Toast.LENGTH_SHORT).show()
            }
        }

        btnConfirm.setOnClickListener {
            val selected = mutableListOf<String>()
            if (cbPhonePe.isChecked) selected.add("com.phonepe.app")
            if (cbGPay.isChecked)    selected.add("com.google.android.apps.nbu.paisa.user")
            if (cbPaytm.isChecked)   selected.add("net.one97.paytm")
            if (cbBhim.isChecked)    selected.add("in.org.npci.upiapp")
            selected.addAll(customPackages)

            if (selected.isEmpty()) {
                Toast.makeText(this, "Please select at least one application to monitor", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                val record = ConsentRecord(
                    id = 1,
                    grantedAt = System.currentTimeMillis(),
                    allowedPackages = selected,
                    version = "1.0"
                )

                withContext(Dispatchers.IO) {
                    db.kharchDao().saveConsent(record)
                    ApiClient.syncConsent(
                        serverUrl = prefs.serverUrl,
                        deviceId  = prefs.deviceId,
                        allowedPackages = selected,
                        version = "1.0",
                        token = prefs.authToken
                    )
                }

                consentSaved = true
                Toast.makeText(this@ConsentActivity, "Consent saved", Toast.LENGTH_SHORT).show()

                val listenerEnabled = NotificationManagerCompat
                    .getEnabledListenerPackages(this@ConsentActivity)
                    .contains(packageName)

                if (listenerEnabled) {
                    // Notification access already granted — proceed directly
                    navigateNext()
                } else {
                    // Show the step-by-step restricted settings card
                    showRestrictedStepsIfNeeded()
                }
            }
        }
    }

    // ─── onResume: Poll for listener being enabled after user returns from Settings ───

    override fun onResume() {
        super.onResume()
        if (!consentSaved) return

        val listenerEnabled = NotificationManagerCompat
            .getEnabledListenerPackages(this)
            .contains(packageName)

        if (listenerEnabled) {
            // All steps complete — show success and navigate
            tvStepsComplete.visibility = View.VISIBLE
            btnStep1.isEnabled = false
            btnStep2.isEnabled = false
            btnStep3.isEnabled = false
            navigateNext()
        }
    }

    // ─── Helpers ───

    /**
     * Show the restricted settings card on Android 13+.
     * On older versions, just open notification listener settings and proceed.
     */
    private fun showRestrictedStepsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            cardRestrictedSteps.visibility = View.VISIBLE
        } else {
            // Android < 13 — no restricted settings needed; open listener settings directly
            Toast.makeText(
                this,
                "Enable Kharch Companion in Notification Access",
                Toast.LENGTH_LONG
            ).show()
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
            if (isEditMode) {
                finish()
            } else {
                startActivity(Intent(this, OemWizardActivity::class.java))
                finish()
            }
        }
    }

    private fun navigateNext() {
        if (isEditMode) {
            finish()
        } else {
            startActivity(Intent(this, OemWizardActivity::class.java))
            finish()
        }
    }

    /**
     * Build a manufacturer-aware hint explaining where to find "Allow restricted settings".
     * Xiaomi/MIUI/Vivo/Oppo/Realme hide it at the very bottom or in the About section;
     * Samsung/Google/Motorola/OnePlus use the standard 3-dot top-right menu.
     */
    private fun buildStep2Hint(): String {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            manufacturer.containsAny("xiaomi", "redmi", "poco", "vivo", "oppo", "realme", "oneplus") ->
                "Scroll to the VERY BOTTOM of the App Info screen (some devices also show it under " +
                "\"Additional settings\" or the \u22ee top-right menu) and tap \"Allow restricted settings\". " +
                "Verify with PIN/Fingerprint."
            else ->
                "Tap the \u22ee (3-dot menu) in the top-right corner of the App Info screen and tap " +
                "\"Allow restricted settings\". Verify with PIN/Fingerprint."
        }
    }

    private fun String.containsAny(vararg values: String): Boolean =
        values.any { this.contains(it) }

    private fun addCustomPackageView(pkg: String, container: LinearLayout) {
        if (!customPackages.contains(pkg)) {
            customPackages.add(pkg)
        }

        val row = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { setMargins(0, 8, 0, 0) }
        }

        val tv = TextView(this).apply {
            text = pkg
            setTextColor(getColor(R.color.text_primary))
            textSize = 13f
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val btnRemove = Button(this).apply {
            text = "Remove"
            textSize = 11f
            setTextColor(getColor(R.color.danger))
            setBackgroundColor(android.graphics.Color.TRANSPARENT)
            setOnClickListener {
                customPackages.remove(pkg)
                container.removeView(row)
            }
        }

        row.addView(tv)
        row.addView(btnRemove)
        container.addView(row)
    }
}
