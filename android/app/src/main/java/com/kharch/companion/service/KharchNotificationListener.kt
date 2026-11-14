package com.kharch.companion.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.data.NotificationEvent
import com.kharch.companion.data.SyncQueueItem
import com.kharch.companion.parser.ParserFactory
import com.kharch.companion.util.HashUtils
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class KharchNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    companion object {
        var isConnected = false
            private set

        // 12-digit UTR pattern used for stable idempotency keys
        private val UTR_REGEX = Regex("\\b(\\d{12})\\b")

        // Messaging apps from all major Indian OEMs (Google, Samsung, OnePlus, Xiaomi, Vivo, Oppo)
        private val MESSAGING_PACKAGES = setOf(
            "com.google.android.apps.messaging",
            "com.samsung.android.messaging",
            "com.oneplus.mms",
            "com.coloros.mms",
            "com.android.mms",
            "com.miui.sms",
            "com.vivo.mms"
        )

        // Bank SMS/UPI debit-credit & salary signal pattern — captures all Indian bank alert formats
        private val DEBIT_CREDIT_REGEX = Regex(
            "(?:debited|credited|spent|paid|sent|received|deposited|salary|sal|stipend|payroll).*?(?:rs\\.?|inr|₹|a\\/c|acc|vpa|upi|ref|utr)|(?:rs\\.?|inr|₹)\\s*[\\d,]+(?:\\.\\d{1,2})?.*?(?:debited|credited|spent|paid|sent|received|deposited|salary|a\\/c)",
            RegexOption.IGNORE_CASE
        )
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
        val prefs = com.kharch.companion.util.PreferenceManager(applicationContext)
        if (prefs.isForegroundServiceEnabled && !KharchForegroundService.isServiceActive(applicationContext)) {
            KharchForegroundService.startService(applicationContext)
        }
    }

    override fun onListenerDisconnected() {
        isConnected = false
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val notification = sbn.notification ?: return

        // === FILTER 1: Skip group summary notifications (they aggregate child notifications) ===
        if ((notification.flags and Notification.FLAG_GROUP_SUMMARY) != 0) return

        // === FILTER 2: Skip ongoing/progress notifications (e.g. download progress, media player) ===
        if ((notification.flags and Notification.FLAG_ONGOING_EVENT) != 0) return

        val pkgName = sbn.packageName ?: return
        val extras = notification.extras ?: return

        scope.launch {
            val db = KharchDatabase.getDatabase(applicationContext)
            val dao = db.kharchDao()

            // Check allowlist
            val consent = dao.getConsent() ?: return@launch
            if (!consent.allowedPackages.contains(pkgName)) return@launch

            // Extract title and body
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""

            if (title.isBlank() && text.isBlank()) return@launch

            // === FILTER 3: For messaging apps (bank SMS), require payment/salary signal keywords ===
            val isMessagingApp = MESSAGING_PACKAGES.contains(pkgName)
            if (isMessagingApp) {
                val combinedText = "$title $text"
                if (!DEBIT_CREDIT_REGEX.containsMatchIn(combinedText)) {
                    // Not a payment SMS — discard on-device, never stored
                    return@launch
                }
            }

            // Use the notification's own stable timestamp (not wall-clock time)
            val eventTimestamp = notification.`when`.takeIf { it > 0 } ?: sbn.postTime
            val notificationId = sbn.id

            // Extract 12-digit UTR if present (most stable deduplication key)
            val rawText = "$title $text".trim()
            val referenceId = UTR_REGEX.find(rawText)?.groupValues?.get(1)

            // Per-package lightweight parser (for local preview only; server does full parse)
            val parser = ParserFactory.getParser(pkgName)
            val parsed = parser.parse(title, text, eventTimestamp)

            // Generate idempotency key using fixed eventTimestamp and notificationId
            val (idempotencyKey, timestampRounded) = HashUtils.generateIdempotencyKey(
                eventTimestamp = eventTimestamp,
                notificationId = notificationId,
                amount = parsed.amount,
                sourceApp = parsed.sourceApp,
                rawText = rawText,
                referenceId = if (!referenceId.isNullOrBlank()) referenceId else parsed.referenceId
            )

            // Check local duplicate
            val existing = dao.getEventByIdempotencyKey(idempotencyKey)
            if (existing != null) return@launch

            // Store event locally
            val event = NotificationEvent(
                idempotencyKey = idempotencyKey,
                type = parsed.type,
                amount = parsed.amount,
                counterparty = parsed.counterparty,
                referenceId = referenceId ?: parsed.referenceId,
                timestamp = eventTimestamp,
                timestampRoundedToMinute = timestampRounded,
                sourceApp = parsed.sourceApp,
                rawText = rawText,
                parseStatus = parsed.parseStatus
            )

            val insertedId = dao.insertNotificationEvent(event)
            if (insertedId > 0) {
                val queueItem = SyncQueueItem(
                    notificationEventId = insertedId,
                    status = "PENDING",
                    retryCount = 0
                )
                dao.insertSyncQueueItem(queueItem)
                com.kharch.companion.sync.SyncManager.triggerImmediateSync(applicationContext)
            }
        }
    }
}
