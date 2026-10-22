package com.kharch.companion.parser

interface NotificationParser {
    val packageName: String
    fun parse(title: String, text: String, timestamp: Long): ParsedNotification
}
