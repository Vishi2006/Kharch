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
    }

    override fun onListenerConnected() {
        super.onListenerConnected()
        isConnected = true
    }

    override fun onListenerDisconnected() {
        isConnected = false
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null) return

        val pkgName = sbn.packageName ?: return
        val extras = sbn.notification?.extras ?: return

        scope.launch {
            val db = KharchDatabase.getDatabase(applicationContext)
            val dao = db.kharchDao()

            // 2c: Only process notifications from packages in current allowedPackages list (re-checked live)
            val consent = dao.getConsent() ?: return@launch
            val allowedList = consent.allowedPackages

            if (!allowedList.contains(pkgName)) {
                // Immediately discard anything outside allowlist — nothing outside is stored
                return@launch
            }

            // Extract title and text
            val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
            val text = (extras.getCharSequence(Notification.EXTRA_BIG_TEXT)
                ?: extras.getCharSequence(Notification.EXTRA_TEXT))?.toString() ?: ""

            if (title.isBlank() && text.isBlank()) {
                return@launch
            }

            val postTime = if (sbn.postTime > 0) sbn.postTime else System.currentTimeMillis()

            // 2d: Per-package parser
            val parser = ParserFactory.getParser(pkgName)
            val parsed = parser.parse(title, text, postTime)

            // 2e: IdempotencyKey = SHA-256 of timestamp_rounded_to_minute + amount + sourceApp + rawText
            val (idempotencyKey, timestampRounded) = HashUtils.generateIdempotencyKey(
                timestamp = parsed.timestamp,
                amount = parsed.amount,
                sourceApp = parsed.sourceApp,
                rawText = parsed.rawText
            )

            // Check if already captured locally
            val existing = dao.getEventByIdempotencyKey(idempotencyKey)
            if (existing != null) {
                // Duplicate — ignore
                return@launch
            }

            // Store event locally
            val event = NotificationEvent(
                idempotencyKey = idempotencyKey,
                type = parsed.type,
                amount = parsed.amount,
                counterparty = parsed.counterparty,
                referenceId = parsed.referenceId,
                timestamp = parsed.timestamp,
                timestampRoundedToMinute = timestampRounded,
                sourceApp = parsed.sourceApp,
                rawText = parsed.rawText,
                parseStatus = parsed.parseStatus
            )

            val insertedId = dao.insertNotificationEvent(event)
            if (insertedId > 0) {
                // Enqueue in SyncQueue
                val queueItem = SyncQueueItem(
                    notificationEventId = insertedId,
                    status = "PENDING",
                    retryCount = 0
                )
                dao.insertSyncQueueItem(queueItem)
            }
        }
    }
}
