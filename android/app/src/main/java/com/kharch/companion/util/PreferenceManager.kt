package com.kharch.companion.util

import android.content.Context
import android.content.SharedPreferences
import java.util.UUID

class PreferenceManager(context: Context) {
    private val prefs: SharedPreferences =
        context.getSharedPreferences("kharch_prefs", Context.MODE_PRIVATE)

    companion object {
        private const val KEY_SERVER_URL = "server_url"
        private const val KEY_DEVICE_ID = "device_id"
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_FG_ENABLED = "fg_service_enabled"
        private const val DEFAULT_SERVER_URL = "https://kharch2026.vercel.app"
    }

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, DEFAULT_SERVER_URL) ?: DEFAULT_SERVER_URL
        set(value) = prefs.edit().putString(KEY_SERVER_URL, value.trimEnd('/')).apply()

    var authToken: String?
        get() = prefs.getString(KEY_AUTH_TOKEN, null)
        set(value) = prefs.edit().putString(KEY_AUTH_TOKEN, value).apply()

    var isForegroundServiceEnabled: Boolean
        get() = prefs.getBoolean(KEY_FG_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_FG_ENABLED, value).apply()

    val isPaired: Boolean
        get() = !authToken.isNullOrEmpty() && serverUrl.isNotEmpty()

    val deviceId: String
        get() {
            var id = prefs.getString(KEY_DEVICE_ID, null)
            if (id == null) {
                id = UUID.randomUUID().toString()
                prefs.edit().putString(KEY_DEVICE_ID, id).apply()
            }
            return id
        }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
