package com.kharch.companion.util

import java.security.MessageDigest

object HashUtils {
    fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    /**
     * Generate a stable idempotency key for a notification event.
     *
     * Priority:
     * 1. If a 12-digit UTR (referenceId) is present: SHA-256(sourceApp + "_" + referenceId + "_" + amount)
     *    — This is the most stable key; UTR is permanent and unique per UPI transaction.
     * 2. Otherwise: SHA-256(sourceApp + "_" + (eventTimestamp / 10000) + "_" + notificationId + "_" + rawText.trim())
     *    — Uses the notification's own stable `when` timestamp and notification ID, NOT wall-clock minute rounding.
     *    Dividing by 10000ms (10 seconds) groups rapid notification updates together while still being
     *    unique across different transactions.
     *
     * @param eventTimestamp The notification's sbn.notification.when value (original post time), NOT System.currentTimeMillis()
     * @param notificationId The sbn.id (notification identifier from the posting app)
     * @param amount The parsed transaction amount
     * @param sourceApp The package name of the posting app
     * @param rawText The raw notification body text (trimmed)
     * @param referenceId Optional 12-digit UTR reference ID if detected in the notification text
     */
    fun generateIdempotencyKey(
        eventTimestamp: Long,
        notificationId: Int,
        amount: Double,
        sourceApp: String,
        rawText: String,
        referenceId: String? = null
    ): Pair<String, Long> {
        val timestampRoundedToMinute = (eventTimestamp / 60000L) * 60000L

        val data = if (!referenceId.isNullOrBlank()) {
            // UTR-based key: stable and globally unique per UPI transaction
            "${sourceApp}_${referenceId}_${amount}"
        } else {
            // Fallback: 10-second bucket + notification ID + raw text
            "${sourceApp}_${eventTimestamp / 10000}_${notificationId}_${rawText.trim()}"
        }

        return Pair(sha256(data), timestampRoundedToMinute)
    }
}
