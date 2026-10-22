package com.kharch.companion.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "notification_event",
    indices = [Index(value = ["idempotencyKey"], unique = true)]
)
data class NotificationEvent(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val idempotencyKey: String,
    val type: String, // CREDIT, DEBIT, UNKNOWN
    val amount: Double,
    val counterparty: String,
    val referenceId: String?,
    val timestamp: Long,
    val timestampRoundedToMinute: Long,
    val sourceApp: String,
    val rawText: String,
    val parseStatus: String, // "parsed" or "unparsed"
    val createdAt: Long = System.currentTimeMillis()
)
