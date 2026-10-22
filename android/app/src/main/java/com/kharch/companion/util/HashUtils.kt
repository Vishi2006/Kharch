package com.kharch.companion.util

import java.security.MessageDigest

object HashUtils {
    fun sha256(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }

    fun generateIdempotencyKey(
        timestamp: Long,
        amount: Double,
        sourceApp: String,
        rawText: String
    ): Pair<String, Long> {
        val timestampRoundedToMinute = (timestamp / 60000L) * 60000L
        val data = "${timestampRoundedToMinute}_${amount}_${sourceApp}_${rawText}"
        return Pair(sha256(data), timestampRoundedToMinute)
    }
}
