package com.kharch.companion.parser

import java.util.regex.Pattern

class PhonePeParser : NotificationParser {
    override val packageName: String = "com.phonepe.app"

    private val amountRegex = Pattern.compile("(?:₹|Rs\\.?|INR)\\s*([\\d,]+(?:\\.\\d{1,2})?)", Pattern.CASE_INSENSITIVE)
    private val debitKeywords = listOf("paid", "debited", "payment of", "sent")
    private val creditKeywords = listOf("received", "credited", "added to", "refund")

    private val counterpartyToRegex = Pattern.compile("(?:paid to|payment to|payment of .* to|debited .* to|sent to)\\s+([A-Za-z0-9\\s&.'_-]{2,30})", Pattern.CASE_INSENSITIVE)
    private val counterpartyFromRegex = Pattern.compile("(?:received from|received .* from|credited .* from)\\s+([A-Za-z0-9\\s&.'_-]{2,30})", Pattern.CASE_INSENSITIVE)
    private val refRegex = Pattern.compile("(?:Ref|Txn\\s*ID)[:\\s]*([A-Za-z0-9]{6,25})", Pattern.CASE_INSENSITIVE)

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

        var counterparty = ""
        if (type == "DEBIT") {
            val toMatcher = counterpartyToRegex.matcher(fullText)
            if (toMatcher.find()) {
                counterparty = toMatcher.group(1)?.trim() ?: ""
            }
        } else if (type == "CREDIT") {
            val fromMatcher = counterpartyFromRegex.matcher(fullText)
            if (fromMatcher.find()) {
                counterparty = fromMatcher.group(1)?.trim() ?: ""
            }
        }

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
