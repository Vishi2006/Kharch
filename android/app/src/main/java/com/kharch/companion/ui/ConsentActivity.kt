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

    companion object {
        val UPI_PACKAGES = listOf(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user",
            "net.one97.paytm",
            "in.org.npci.upiapp",
            "in.amazon.mShop.android.shopping",
            "com.dreamplug.androidapp", // CRED
            "money.super.app",          // Super.money
            "com.navi.app",             // Navi
            "com.mobikwik_new",         // MobiKwik
            "com.freecharge.android",   // Freecharge
            "org.altruist.BajajExperia" // Bajaj Finserv
        )

        val BANK_PACKAGES = listOf(
            "com.snapwork.hdfc",            // HDFC Bank MobileBanking
            "com.enstage.wibmo.hdfc",        // HDFC PayZapp
            "com.sbi.lotusintouch",         // State Bank of India (YONO SBI)
            "com.ge.capital.konysbiapp",     // SBI Card
            "com.csam.icici.bank.imobile",   // ICICI Bank (iMobile Pay)
            "com.axis.mobile",              // Axis Bank Mobile
            "com.msf.kbank.mobile",          // Kotak Mahindra Bank (Kotak811)
            "com.bankofbaroda.mconnect",     // Bank of Baroda (bob World)
            "com.pnb.pnbone",               // Punjab National Bank (PNB ONE)
            "com.canarabank.mobility",       // Canara Bank (ai1)
            "com.infrasofttech.uboi",        // Union Bank of India (Vyom)
            "com.indusind.mobile",          // IndusInd Bank (IndusMobile)
            "com.idfcfirstbank.optimus",     // IDFC FIRST Bank
            "com.fedmobile",                // Federal Bank (FedMobile)
            "com.rblbank.mobank",           // RBL Bank (MoBank)
            "com.yesbank",                  // Yes Bank
            "com.infrasoft.indianbank",     // Indian Bank (IndOASIS)
            "com.infrasoft.cbi",            // Central Bank of India
            "com.boi.mpay",                 // Bank of India (BOI Mobile)
            "com.aubank.au0101",            // AU Small Finance Bank
            "money.jupiter",                // Jupiter Neobank
            "money.fi.banking"              // Fi Money Neobank
        )

        val SMS_PACKAGES = listOf(
            "com.google.android.apps.messaging", // Google Messages
            "com.samsung.android.messaging",    // Samsung Messages
            "com.oneplus.mms",                  // OnePlus Messages
            "com.coloros.mms",                  // Oppo / Realme Messages
            "com.miui.sms",                     // Xiaomi MIUI SMS
            "com.vivo.mms",                     // Vivo Messages
            "com.android.mms"                   // Stock Android MMS
        )

        val DEFAULT_ALLOWED_PACKAGES = (UPI_PACKAGES + BANK_PACKAGES + SMS_PACKAGES).distinct()
    }

    private val customPackages = mutableListOf<String>()

    // Restricted Settings unlock flow views (Android 13+)
    private lateinit var cardRestrictedSteps: MaterialCardView
    private lateinit var tvStep1Hint: TextView
    private lateinit var tvStepsComplete: TextView
    private lateinit var btnStep1: Button
    private lateinit var btnStep2: Button
    private lateinit var scrollViewConsent: NestedScrollView

    // Track whether consent was saved so onResume can check listener status
    private var consentSaved = false
    private var isEditMode = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_consent)

        isEditMode = intent.getBooleanExtra("IS_EDIT_MODE", false)

        val cbPhonePe        = findViewById<CheckBox>(R.id.cbPhonePe)
        val cbGPay           = findViewById<CheckBox>(R.id.cbGPay)
        val cbPaytm          = findViewById<CheckBox>(R.id.cbPaytm)
        val cbBhim           = findViewById<CheckBox>(R.id.cbBhim)
        val cbAllIndianBanks = findViewById<CheckBox>(R.id.cbAllIndianBanks)
        val cbBankSms        = findViewById<CheckBox>(R.id.cbBankSms)
        val etCustomPackage  = findViewById<TextInputEditText>(R.id.etCustomPackage)
        val btnAddPackage    = findViewById<Button>(R.id.btnAddPackage)
        val containerCustom  = findViewById<LinearLayout>(R.id.containerCustomPackages)
        val btnConfirm       = findViewById<Button>(R.id.btnConfirmConsent)

        // Restricted Settings card views
        cardRestrictedSteps = findViewById(R.id.cardRestrictedSteps)
        tvStep1Hint         = findViewById(R.id.tvStep1Hint)
        tvStepsComplete     = findViewById(R.id.tvStepsComplete)
        btnStep1            = findViewById(R.id.btnStep1)
        btnStep2            = findViewById(R.id.btnStep2)
        scrollViewConsent   = findViewById(R.id.scrollViewConsent)

        // Set manufacturer-aware hint for Step 1 (App Info unlock)
        tvStep1Hint.text = buildStep1Hint()

        // Step 1: Open App Info directly to allow restricted settings
        btnStep1.setOnClickListener {
            val intent = Intent(
                Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                Uri.fromParts("package", packageName, null)
            )
            startActivity(intent)
        }

        // Step 2: Open Notification Access to toggle Kharch Companion ON
        btnStep2.setOnClickListener {
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
            btnStep2.text = "✓ Notification Access Granted"
        } else {
            // Make unlock buttons immediately visible on Android 13+
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
                cbAllIndianBanks.isChecked = list.any { BANK_PACKAGES.contains(it) }
                cbBankSms.isChecked = list.any { SMS_PACKAGES.contains(it) }

                val defaultPkgs = DEFAULT_ALLOWED_PACKAGES.toSet()
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
            val selected = mutableSetOf<String>()
            if (cbPhonePe.isChecked) selected.add("com.phonepe.app")
            if (cbGPay.isChecked)    selected.add("com.google.android.apps.nbu.paisa.user")
            if (cbPaytm.isChecked)   selected.add("net.one97.paytm")
            if (cbBhim.isChecked)    selected.add("in.org.npci.upiapp")
            if (cbAllIndianBanks.isChecked) selected.addAll(BANK_PACKAGES)
            if (cbBankSms.isChecked)        selected.addAll(SMS_PACKAGES)
            if (cbPhonePe.isChecked || cbGPay.isChecked || cbPaytm.isChecked || cbBhim.isChecked) {
                selected.addAll(UPI_PACKAGES)
            }
            selected.addAll(customPackages)

            val finalList = selected.toList()

            if (finalList.isEmpty()) {
                Toast.makeText(this, "Please select at least one application to monitor", Toast.LENGTH_SHORT).show()
                return@setOnClickListener
            }

            lifecycleScope.launch {
                val record = ConsentRecord(
                    id = 1,
                    grantedAt = System.currentTimeMillis(),
                    allowedPackages = finalList,
                    version = "1.0"
                )

                withContext(Dispatchers.IO) {
                    db.kharchDao().saveConsent(record)
                    ApiClient.syncConsent(
                        serverUrl = prefs.serverUrl,
                        deviceId  = prefs.deviceId,
                        allowedPackages = finalList,
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
            btnStep2.text = "✓ Notification Access Granted"

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

        val defaultPkgs = DEFAULT_ALLOWED_PACKAGES

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
                startActivity(Intent(this, MainActivity::class.java))
                finish()
            }
        }
    }

    private fun navigateNext() {
        if (isEditMode) {
            finish()
        } else {
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }

    private fun buildStep1Hint(): String {
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
