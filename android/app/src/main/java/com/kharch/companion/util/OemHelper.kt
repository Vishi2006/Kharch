package com.kharch.companion.util

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast

object OemHelper {

    enum class OemType(val displayName: String, val slug: String) {
        XIAOMI("Xiaomi / Redmi / POCO", "xiaomi"),
        REALME("Realme", "realme"),
        VIVO("Vivo / iQOO", "vivo"),
        OPPO("Oppo / OnePlus", "oppo"),
        SAMSUNG("Samsung", "samsung"),
        GENERIC("Standard Android", "")
    }

    fun getDetectedOem(): OemType {
        val m = Build.MANUFACTURER.lowercase()
        return when {
            m.contains("xiaomi") || m.contains("redmi") || m.contains("poco") -> OemType.XIAOMI
            m.contains("realme") -> OemType.REALME
            m.contains("vivo") || m.contains("iqoo") -> OemType.VIVO
            m.contains("oppo") || m.contains("oneplus") -> OemType.OPPO
            m.contains("samsung") -> OemType.SAMSUNG
            else -> OemType.GENERIC
        }
    }

    fun getInstructions(oem: OemType): String {
        return when (oem) {
            OemType.XIAOMI -> """
                1. Autostart: Security app → Permissions → Autostart → Enable Kharch Companion.
                2. Battery Saver: App Info → Battery Saver → Select 'No Restrictions'.
                3. Lock App: In Recent Apps tray, press and hold Kharch and tap the Lock icon.
            """.trimIndent()

            OemType.REALME -> """
                1. Auto-launch: Settings → Apps → Auto-launch → Turn on for Kharch Companion.
                2. Battery: Settings → Battery → Advanced Settings → Optimize Battery Use → Select 'Don't Optimize'.
                3. Background Activity: Allow foreground and background running.
            """.trimIndent()

            OemType.VIVO -> """
                1. High Background Power: Settings → Battery → High Background Power Consumption → Enable Kharch.
                2. Autostart: Settings → Applications & Permissions → Permission Management → Autostart.
                3. Lock in Recents: Swipe down on the Kharch card in recent tasks to lock it.
            """.trimIndent()

            OemType.OPPO -> """
                1. Startup Manager: Settings → App Management → Auto-start Apps → Enable Kharch Companion.
                2. Battery: Settings → Battery → App Battery Management → Kharch → Allow Background Activity.
                3. Don't Optimize: Disable Sleep Standby Optimization for Kharch.
            """.trimIndent()

            OemType.SAMSUNG -> """
                1. Never Sleeping Apps: Settings → Battery & Device Care → Battery → Background Usage Limits → Never Sleeping Apps → Add Kharch Companion.
                2. App Battery: Settings → Apps → Kharch Companion → Battery → Select 'Unrestricted'.
                3. Turn off 'Put unused apps to sleep'.
            """.trimIndent()

            OemType.GENERIC -> """
                1. Battery Optimization: Exempt Kharch Companion from Doze and battery saving.
                2. Unrestricted Data: Allow background data usage without restrictions.
                3. App Lock: Lock the app in your recents overview if available.
            """.trimIndent()
        }
    }

    fun getDontKillMyAppUrl(oem: OemType): String {
        return if (oem.slug.isNotEmpty()) {
            "https://dontkillmyapp.com/${oem.slug}"
        } else {
            "https://dontkillmyapp.com"
        }
    }

    fun isBatteryOptimizationIgnored(context: Context): Boolean {
        val powerManager = context.getSystemService(Context.POWER_SERVICE) as? PowerManager ?: return false
        return powerManager.isIgnoringBatteryOptimizations(context.packageName)
    }

    fun requestIgnoreBatteryOptimization(context: Context) {
        try {
            if (isBatteryOptimizationIgnored(context)) {
                Toast.makeText(context, "Battery optimization is already disabled for Kharch", Toast.LENGTH_SHORT).show()
                return
            }
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${context.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (_: Exception) {
            // Fallback to generic settings list
            openGenericBatteryOptimizationSettings(context)
        }
    }

    fun openGenericBatteryOptimizationSettings(context: Context) {
        try {
            val intent = Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            context.startActivity(intent)
        } catch (e: Exception) {
            Toast.makeText(context, "Could not open battery settings: ${e.message}", Toast.LENGTH_SHORT).show()
        }
    }

    fun openOemSpecificSettings(context: Context) {
        val oemIntents = getOemIntents(context)
        for (intent in oemIntents) {
            try {
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                if (intent.resolveActivity(context.packageManager) != null) {
                    context.startActivity(intent)
                    return
                }
            } catch (_: Exception) {
                // Try next intent
            }
        }
        // Fallback to standard battery optimization
        openGenericBatteryOptimizationSettings(context)
    }

    private fun getOemIntents(context: Context): List<Intent> {
        val list = mutableListOf<Intent>()
        val pkg = context.packageName

        // Xiaomi intents
        list.add(Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity")))
        list.add(Intent().setComponent(ComponentName("com.miui.securitycenter", "com.miui.powercenter.PowerSettings")))

        // Realme / Oppo intents
        list.add(Intent().setComponent(ComponentName("com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity")))
        list.add(Intent().setComponent(ComponentName("com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity")))
        list.add(Intent().setComponent(ComponentName("com.coloros.oppoguardelf", "com.coloros.powermanager.fuelga设置ge.PowerUsageModelActivity")))

        // Vivo intents
        list.add(Intent().setComponent(ComponentName("com.iqoo.secure", "com.iqoo.secure.ui.phoneoptimize.AddWhiteListActivity")))
        list.add(Intent().setComponent(ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity")))

        // Samsung intents
        list.add(Intent().setComponent(ComponentName("com.samsung.android.lool", "com.samsung.android.sm.battery.ui.BatteryActivity")))
        list.add(Intent().setComponent(ComponentName("com.samsung.android.sm", "com.samsung.android.sm.ui.battery.BatteryActivity")))

        return list
    }
}
