package com.kharch.companion.ui

import android.content.Intent
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

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_consent)

        val isEditMode = intent.getBooleanExtra("IS_EDIT_MODE", false)

        val cbPhonePe = findViewById<CheckBox>(R.id.cbPhonePe)
        val cbGPay = findViewById<CheckBox>(R.id.cbGPay)
        val cbPaytm = findViewById<CheckBox>(R.id.cbPaytm)
        val cbBhim = findViewById<CheckBox>(R.id.cbBhim)
        val etCustomPackage = findViewById<TextInputEditText>(R.id.etCustomPackage)
        val btnAddPackage = findViewById<Button>(R.id.btnAddPackage)
        val containerCustom = findViewById<LinearLayout>(R.id.containerCustomPackages)
        val btnConfirm = findViewById<Button>(R.id.btnConfirmConsent)

        val db = KharchDatabase.getDatabase(this)
        val prefs = PreferenceManager(this)

        lifecycleScope.launch {
            val existingConsent = withContext(Dispatchers.IO) {
                db.kharchDao().getConsent()
            }

            if (!isEditMode && existingConsent != null && existingConsent.allowedPackages.isNotEmpty()) {
                // Already consented, skip to Health Check
                startActivity(Intent(this@ConsentActivity, MainActivity::class.java))
                finish()
                return@launch
            }

            // If existing consent, reflect in checkboxes
            if (existingConsent != null) {
                val list = existingConsent.allowedPackages
                cbPhonePe.isChecked = list.contains("com.phonepe.app")
                cbGPay.isChecked = list.contains("com.google.android.apps.nbu.paisa.user")
                cbPaytm.isChecked = list.contains("net.one97.paytm")
                cbBhim.isChecked = list.contains("in.org.npci.upiapp")

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
            if (cbGPay.isChecked) selected.add("com.google.android.apps.nbu.paisa.user")
            if (cbPaytm.isChecked) selected.add("net.one97.paytm")
            if (cbBhim.isChecked) selected.add("in.org.npci.upiapp")
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
                    // Sync to backend (2a requirement)
                    ApiClient.syncConsent(
                        serverUrl = prefs.serverUrl,
                        deviceId = prefs.deviceId,
                        allowedPackages = selected,
                        version = "1.0",
                        token = prefs.authToken
                    )
                }

                Toast.makeText(this@ConsentActivity, "Consent saved", Toast.LENGTH_SHORT).show()

                // Check if notification listener permission is granted
                val isListenerEnabled = NotificationManagerCompat.getEnabledListenerPackages(this@ConsentActivity)
                    .contains(packageName)

                if (!isListenerEnabled) {
                    // Direct user to enable notification listener
                    Toast.makeText(
                        this@ConsentActivity,
                        "Enable Kharch Companion in Notification Access",
                        Toast.LENGTH_LONG
                    ).show()
                    startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                }

                if (isEditMode) {
                    finish()
                } else {
                    startActivity(Intent(this@ConsentActivity, OemWizardActivity::class.java))
                    finish()
                }
            }
        }
    }

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
