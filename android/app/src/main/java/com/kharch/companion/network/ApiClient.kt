package com.kharch.companion.network

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
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
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
}
