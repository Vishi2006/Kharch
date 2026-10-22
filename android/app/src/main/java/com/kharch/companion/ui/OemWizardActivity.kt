package com.kharch.companion.ui

import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import com.kharch.companion.R
import com.kharch.companion.service.KharchForegroundService
import com.kharch.companion.util.OemHelper

class OemWizardActivity : AppCompatActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_oem_wizard)

        val oem = OemHelper.getDetectedOem()
        val tvDetected = findViewById<TextView>(R.id.tvDetectedManufacturer)
        val tvInstructionsHeader = findViewById<TextView>(R.id.tvOemInstructionsHeader)
        val tvInstructionsBody = findViewById<TextView>(R.id.tvOemInstructionsBody)

        val btnOpenOem = findViewById<Button>(R.id.btnOpenOemSettings)
        val btnBattery = findViewById<Button>(R.id.btnOpenBatteryOptimization)
        val btnDontKill = findViewById<Button>(R.id.btnDontKillMyApp)
        val btnForeground = findViewById<Button>(R.id.btnStartForegroundService)
        val btnProceed = findViewById<Button>(R.id.btnProceedToHome)

        tvDetected.text = "Detected Manufacturer: ${Build.MANUFACTURER.uppercase()} (${oem.displayName})"
        tvInstructionsHeader.text = "Setup for ${oem.displayName}"
        tvInstructionsBody.text = OemHelper.getInstructions(oem)

        btnOpenOem.setOnClickListener {
            OemHelper.openOemSpecificSettings(this)
        }

        btnBattery.setOnClickListener {
            OemHelper.requestIgnoreBatteryOptimization(this)
        }

        btnDontKill.setOnClickListener {
            val url = OemHelper.getDontKillMyAppUrl(oem)
            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
            startActivity(intent)
        }

        btnForeground.setOnClickListener {
            KharchForegroundService.startService(this)
            Toast.makeText(this, "Foreground service started", Toast.LENGTH_SHORT).show()
            btnForeground.isEnabled = false
            btnForeground.text = "Foreground Service Active"
        }

        btnProceed.setOnClickListener {
            // Automatically ensure foreground service is started before going to health check
            KharchForegroundService.startService(this)
            startActivity(Intent(this, MainActivity::class.java))
            finish()
        }
    }
}
