package com.kharch.companion.parser

data class ParsedNotification(
    val type: String, // "CREDIT", "DEBIT", "UNKNOWN"
    val amount: Double,
    val counterparty: String,
    val referenceId: String? = null,
    val timestamp: Long,
    val sourceApp: String,
    val rawText: String,
    val parseStatus: String // "parsed" or "unparsed"
)
