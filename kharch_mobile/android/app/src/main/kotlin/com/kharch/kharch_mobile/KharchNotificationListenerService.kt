package com.kharch.kharch_mobile

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.OutputStreamWriter
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest
import java.util.regex.Pattern

class KharchNotificationListenerService : NotificationListenerService() {

    private val serviceScope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        private const val TAG = "KharchNotifService"
        const val PREFS_NAME = "KharchNativePrefs"
        const val KEY_AUTH_TOKEN = "auth_token"
        const val KEY_BACKEND_URL = "backend_url"
        const val KEY_AUTO_SYNC_ENABLED = "auto_sync_enabled"

        // Allowlisted UPI & banking applications
        private val ALLOWLIST = setOf(
            "com.phonepe.app",
            "com.google.android.apps.nbu.paisa.user",
            "net.one97.paytm",
            "in.org.npci.upiapp",
            "com.dreamplug.androidapp",
            "com.sbi.upi",
            "com.csam.icici.bank.imobile",
            "com.hdfcbank.android"
        )

        private val AMOUNT_PATTERN = Pattern.compile("(?:Rs\\.?|INR|₹)\\s*([0-9]+(?:,[0-9]+)*(?:\\.[0-9]{1,2})?)", Pattern.CASE_INSENSITIVE)
        private val DEBIT_PATTERN = Pattern.compile("(?:paid|debited|sent|spent|transferred to|vpa)", Pattern.CASE_INSENSITIVE)
        private val CREDIT_PATTERN = Pattern.compile("(?:received|credited|refunded|deposited)", Pattern.CASE_INSENSITIVE)
        private val COUNTERPARTY_PATTERN = Pattern.compile("(?:to|from|at)\\s+([A-Za-z0-9\\s&.-]{3,30})", Pattern.CASE_INSENSITIVE)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val pkgName = sbn.packageName
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val isEnabled = prefs.getBoolean(KEY_AUTO_SYNC_ENABLED, true)

        if (!isEnabled) return
        if (!ALLOWLIST.contains(pkgName)) return

        val extras = sbn.notification.extras ?: return
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val postTime = sbn.postTime

        val combined = "$title $text"
        val amtMatcher = AMOUNT_PATTERN.matcher(combined)
        if (!amtMatcher.find()) {
            return // Not a financial transaction notification
        }

        val rawAmount = amtMatcher.group(1)?.replace(",", "") ?: return
        val amount = rawAmount.toDoubleOrNull() ?: return

        var type = "DEBIT"
        if (CREDIT_PATTERN.matcher(combined).find() && !DEBIT_PATTERN.matcher(combined).find()) {
            type = "CREDIT"
        }

        var counterparty = "Unknown Counterparty"
        val cpMatcher = COUNTERPARTY_PATTERN.matcher(combined)
        if (cpMatcher.find()) {
            counterparty = cpMatcher.group(1)?.trim() ?: counterparty
        }

        // Idempotency key: SHA-256 of rounded minute, amount, and package
        val roundedMinute = postTime / 60000
        val rawKey = "${roundedMinute}_${amount}_${pkgName}_$combined"
        val idempotencyKey = hashSha256(rawKey)

        Log.d(TAG, "Captured payment notification: $amount ($type) from $pkgName, key: $idempotencyKey")

        // Sync to backend asynchronously in background IO
        serviceScope.launch {
            syncNotificationToBackend(
                amount = amount,
                type = type,
                counterparty = counterparty,
                timestamp = postTime,
                sourceApp = pkgName,
                rawText = combined,
                idempotencyKey = idempotencyKey
            )
        }
    }

    private fun syncNotificationToBackend(
        amount: Double,
        type: String,
        counterparty: String,
        timestamp: Long,
        sourceApp: String,
        rawText: String,
        idempotencyKey: String
    ) {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_AUTH_TOKEN, null)
        var backendUrl = prefs.getString(KEY_BACKEND_URL, "https://kharch2026.vercel.app") ?: "https://kharch2026.vercel.app"

        if (token.isNullOrEmpty()) {
            Log.w(TAG, "No auth token found, caching notification locally")
            return
        }

        backendUrl = backendUrl.trimEnd('/')
        val endpoint = "$backendUrl/api/notifications/sync"

        try {
            val url = URL(endpoint)
            val conn = url.openConnection() as HttpURLConnection
            conn.requestMethod = "POST"
            conn.setRequestProperty("Content-Type", "application/json")
            conn.setRequestProperty("Authorization", "Bearer $token")
            conn.doOutput = true
            conn.connectTimeout = 15000
            conn.readTimeout = 15000

            val item = JSONObject().apply {
                put("amount", amount)
                put("type", type)
                put("counterparty", counterparty)
                put("timestamp", timestamp)
                put("sourceApp", sourceApp)
                put("rawText", rawText)
                put("idempotencyKey", idempotencyKey)
                put("parseStatus", "parsed")
            }

            val body = JSONObject().apply {
                put("events", JSONArray().put(item))
            }

            OutputStreamWriter(conn.outputStream).use { writer ->
                writer.write(body.toString())
                writer.flush()
            }

            val responseCode = conn.responseCode
            Log.d(TAG, "Synced notification to $endpoint, HTTP $responseCode")
            conn.disconnect()
        } catch (e: Exception) {
            Log.e(TAG, "Failed to sync notification to backend: ${e.message}")
        }
    }

    private fun hashSha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
