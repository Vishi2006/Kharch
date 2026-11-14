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
import androidx.core.widget.NestedScrollView
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
    private lateinit var scrollViewConsent: NestedScrollView

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
        scrollViewConsent   = findViewById(R.id.scrollViewConsent)

        // Set the manufacturer-aware hint for Step 2
        tvStep2Hint.text = buildStep2Hint()

        // Wire the 3 numbered step buttons
        btnStep1.setOnClickListener {
            // Button 1 (Open Notification Access):
            // "Tap Kharch Companion. When it says 'App was denied access', tap Close and press Back."
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        btnStep2.setOnClickListener {
            // Button 2 (Open App Info to Unlock):
            // Opens Settings.ACTION_APPLICATION_DETAILS_SETTINGS directly to Kharch Companion's page
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
            startActivity(intent)
        }

        btnStep3.setOnClickListener {
            // Button 3 (Turn On Notification Access):
            // Opens ACTION_NOTIFICATION_LISTENER_SETTINGS again
            startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
        }

        // Check if listener is already granted on launch
        val listenerEnabled = NotificationManagerCompat
            .getEnabledListenerPackages(this)
            .contains(packageName)

        if (listenerEnabled) {
            tvStepsComplete.visibility = View.VISIBLE
            btnStep1.isEnabled = false
            btnStep2.isEnabled = false
            btnStep3.isEnabled = false
            btnStep3.text = "✓ Notification Access Granted"
        } else {
            // Make 3-step unlock buttons immediately visible on Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                cardRestrictedSteps.visibility = View.VISIBLE
            }
        }

        val db    = KharchDatabase.getDatabase(this)
        val prefs = PreferenceManager(this)

        lifecycleScope.launch {
            val existingConsent = withContext(Dispatchers.IO) {
                db.kharchDao().getConsent()
            }

            if (!isEditMode && existingConsent != null && existingConsent.allowedPackages.isNotEmpty()) {
                if (listenerEnabled) {
                    startActivity(Intent(this@ConsentActivity, MainActivity::class.java))
                    finish()
                    return@launch
                }
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
                Toast.makeText(this@ConsentActivity, "Monitored apps saved", Toast.LENGTH_SHORT).show()

                val isListenerEnabled = NotificationManagerCompat
                    .getEnabledListenerPackages(this@ConsentActivity)
                    .contains(packageName)

                if (isListenerEnabled) {
                    navigateNext()
                } else {
                    showRestrictedStepsIfNeeded()
                }
            }
        }
    }

    // ─── onResume: Automatically detect when Notification Access is switched ON ───

    override fun onResume() {
        super.onResume()

        val listenerEnabled = NotificationManagerCompat
            .getEnabledListenerPackages(this)
            .contains(packageName)

        if (listenerEnabled) {
            tvStepsComplete.visibility = View.VISIBLE
            btnStep1.isEnabled = false
            btnStep2.isEnabled = false
            btnStep3.isEnabled = false
            btnStep3.text = "✓ Notification Access Granted"

            if (!consentSaved) {
                saveDefaultConsentAndProceed()
            } else {
                navigateNext()
            }
        }
    }

    private fun saveDefaultConsentAndProceed() {
        val db    = KharchDatabase.getDatabase(this)
        val prefs = PreferenceManager(this)

        val defaultPkgs = listOf(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user",
            "net.one97.paytm",
            "in.org.npci.upiapp"
        )

        lifecycleScope.launch {
            val record = ConsentRecord(
                id = 1,
                grantedAt = System.currentTimeMillis(),
                allowedPackages = defaultPkgs,
                version = "1.0"
            )

            withContext(Dispatchers.IO) {
                db.kharchDao().saveConsent(record)
                ApiClient.syncConsent(
                    serverUrl = prefs.serverUrl,
                    deviceId  = prefs.deviceId,
                    allowedPackages = defaultPkgs,
                    version = "1.0",
                    token = prefs.authToken
                )
            }

            consentSaved = true
            navigateNext()
        }
    }

    // ─── Helpers ───

    private fun showRestrictedStepsIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            cardRestrictedSteps.visibility = View.VISIBLE
            cardRestrictedSteps.post {
                scrollViewConsent.smoothScrollTo(0, cardRestrictedSteps.top)
            }
        } else {
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

    private fun buildStep2Hint(): String {
        val manufacturer = Build.MANUFACTURER.lowercase()
        return when {
            manufacturer.containsAny("xiaomi", "redmi", "poco", "vivo", "oppo", "realme", "oneplus") ->
                "\"Tap ⋮ in the top-right corner (or scroll to the bottom on Xiaomi/Vivo/Realme) and tap 'Allow restricted settings'. Verify with PIN/Fingerprint.\""
            else ->
                "\"Tap ⋮ in the top-right corner of this App Info screen and tap 'Allow restricted settings'. Verify with PIN/Fingerprint.\""
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
