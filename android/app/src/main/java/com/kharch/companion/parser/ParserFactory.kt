package com.kharch.companion.parser

import java.util.regex.Pattern

object ParserFactory {
    private val parsers = mapOf<String, NotificationParser>(
        "com.phonepe.app" to PhonePeParser(),
        "com.google.android.apps.nbu.paisa.user" to GPayParser(),
        "net.one97.paytm" to PaytmParser(),
        "in.org.npci.upiapp" to BhimParser()
    )

    private val amountRegex = Pattern.compile("(?:₹|Rs\\.?|INR)\\s*([\\d,]+(?:\\.\\d{1,2})?)", Pattern.CASE_INSENSITIVE)

    fun getParser(packageName: String): NotificationParser {
        return parsers[packageName] ?: object : NotificationParser {
            override val packageName: String = packageName

            override fun parse(title: String, text: String, timestamp: Long): ParsedNotification {
                val fullText = "$title $text".trim()
                val lower = fullText.lowercase()

                val amountMatcher = amountRegex.matcher(fullText)
                val hasAmount = amountMatcher.find()
                val amount = if (hasAmount) {
                    amountMatcher.group(1)?.replace(",", "")?.toDoubleOrNull() ?: 0.0
                } else {
                    0.0
                }

                val isDebit = lower.contains("debit") || lower.contains("paid") || lower.contains("sent")
                val isCredit = lower.contains("credit") || lower.contains("received") || lower.contains("deposited")

                val type = when {
                    isDebit && !isCredit -> "DEBIT"
                    isCredit && !isDebit -> "CREDIT"
                    else -> "UNKNOWN"
                }

                val parseStatus = if (hasAmount && amount > 0.0 && type != "UNKNOWN") "parsed" else "unparsed"

                return ParsedNotification(
                    type = type,
                    amount = amount,
                    counterparty = "",
                    referenceId = null,
                    timestamp = timestamp,
                    sourceApp = packageName,
                    rawText = fullText,
                    parseStatus = parseStatus
                )
            }
        }
    }
}
