package com.kharch.companion.network

import com.kharch.companion.data.NotificationEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

object ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .build()

    private val JSON = "application/json; charset=utf-8".toMediaType()

    suspend fun syncConsent(
        serverUrl: String,
        deviceId: String,
        allowedPackages: List<String>,
        version: String,
        token: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val bodyJson = JSONObject().apply {
                put("deviceId", deviceId)
                put("allowedPackages", JSONArray(allowedPackages))
                put("version", version)
                put("grantedAt", System.currentTimeMillis())
            }

            val requestBuilder = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/consent")
                .post(bodyJson.toString().toRequestBody(JSON))

            if (!token.isNullOrEmpty()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }

            client.newCall(requestBuilder.build()).execute().use { response ->
                response.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }

    suspend fun revokeConsent(
        serverUrl: String,
        deviceId: String,
        token: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val bodyJson = JSONObject().apply {
                put("deviceId", deviceId)
            }

            val requestBuilder = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/consent")
                .delete(bodyJson.toString().toRequestBody(JSON))

            if (!token.isNullOrEmpty()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }

            client.newCall(requestBuilder.build()).execute().use { response ->
                response.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }

    suspend fun deleteMyData(
        serverUrl: String,
        deviceId: String,
        token: String? = null
    ): Boolean = withContext(Dispatchers.IO) {
        try {
            val bodyJson = JSONObject().apply {
                put("deviceId", deviceId)
            }

            val requestBuilder = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/consent/my-data")
                .delete(bodyJson.toString().toRequestBody(JSON))

            if (!token.isNullOrEmpty()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }

            client.newCall(requestBuilder.build()).execute().use { response ->
                response.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }

    suspend fun syncNotificationEvents(
        serverUrl: String,
        deviceId: String,
        token: String?,
        events: List<NotificationEvent>
    ): Boolean = withContext(Dispatchers.IO) {
        if (events.isEmpty()) return@withContext true
        try {
            val eventsArray = JSONArray()
            events.forEach { event ->
                val obj = JSONObject().apply {
                    put("idempotencyKey", event.idempotencyKey)
                    put("type", event.type)
                    put("amount", event.amount)
                    put("counterparty", event.counterparty)
                    if (event.referenceId != null) put("referenceId", event.referenceId)
                    put("timestamp", event.timestamp)
                    put("timestampRoundedToMinute", event.timestampRoundedToMinute)
                    put("sourceApp", event.sourceApp)
                    put("rawText", event.rawText)
                    put("parseStatus", event.parseStatus)
                }
                eventsArray.put(obj)
            }

            val bodyJson = JSONObject().apply {
                put("deviceId", deviceId)
                put("events", eventsArray)
            }

            val requestBuilder = Request.Builder()
                .url("${serverUrl.trimEnd('/')}/api/notifications/sync")
                .post(bodyJson.toString().toRequestBody(JSON))

            if (!token.isNullOrEmpty()) {
                requestBuilder.header("Authorization", "Bearer $token")
            }

            client.newCall(requestBuilder.build()).execute().use { response ->
                response.isSuccessful
            }
        } catch (_: Exception) {
            false
        }
    }
}
