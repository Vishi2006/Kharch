package com.kharch.companion.parser

import java.util.regex.Pattern

class PaytmParser : NotificationParser {
    override val packageName: String = "net.one97.paytm"

    private val amountRegex = Pattern.compile("(?:₹|Rs\\.?|INR)\\s*([\\d,]+(?:\\.\\d{1,2})?)", Pattern.CASE_INSENSITIVE)
    private val debitKeywords = listOf("paid successfully", "debited", "paid rs", "sent to")
    private val creditKeywords = listOf("received", "credited", "cashback", "added")

    private val counterpartyRegex = Pattern.compile("(?:to|from)\\s+([A-Za-z0-9\\s&.'_-]{2,30})", Pattern.CASE_INSENSITIVE)
    private val refRegex = Pattern.compile("(?:UPI Ref|Txn ID)[:\\s]*([A-Za-z0-9]{6,25})", Pattern.CASE_INSENSITIVE)

    override fun parse(title: String, text: String, timestamp: Long): ParsedNotification {
        val fullText = "$title $text".trim()

        val amountMatcher = amountRegex.matcher(fullText)
        val hasAmount = amountMatcher.find()
        val amount = if (hasAmount) {
            amountMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() ?: 0.0
        } else {
            0.0
        }

        val lower = fullText.lowercase()
        val isDebit = debitKeywords.any { lower.contains(it) }
        val isCredit = creditKeywords.any { lower.contains(it) }

        val type = when {
            isDebit && !isCredit -> "DEBIT"
            isCredit && !isDebit -> "CREDIT"
            else -> "UNKNOWN"
        }

        val cpMatcher = counterpartyRegex.matcher(fullText)
        val counterparty = if (cpMatcher.find()) cpMatcher.group(1)?.trim() ?: "" else ""

        val refMatcher = refRegex.matcher(fullText)
        val referenceId = if (refMatcher.find()) refMatcher.group(1) else null

        val parseStatus = if (hasAmount && amount > 0.0 && type != "UNKNOWN") "parsed" else "unparsed"

        return ParsedNotification(
            type = type,
            amount = amount,
            counterparty = counterparty,
            referenceId = referenceId,
            timestamp = timestamp,
            sourceApp = packageName,
            rawText = fullText,
            parseStatus = parseStatus
        )
    }
}
