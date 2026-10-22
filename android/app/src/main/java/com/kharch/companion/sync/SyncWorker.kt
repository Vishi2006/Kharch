package com.kharch.companion.sync

import android.content.Context
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.kharch.companion.data.KharchDatabase
import com.kharch.companion.network.ApiClient
import com.kharch.companion.util.PreferenceManager

class SyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = PreferenceManager(applicationContext)
        val token = prefs.authToken
        val serverUrl = prefs.serverUrl

        // If companion not paired or no server URL set, skip
        if (token.isNullOrEmpty() || serverUrl.isEmpty()) {
            return Result.success()
        }

        val db = KharchDatabase.getDatabase(applicationContext)
        val dao = db.kharchDao()

        val pendingQueueItems = dao.getPendingSyncQueueItems(limit = 50)
        if (pendingQueueItems.isEmpty()) {
            return Result.success()
        }

        val eventIds = pendingQueueItems.map { it.notificationEventId }
        val events = dao.getEventsByIds(eventIds)

        if (events.isEmpty()) {
            // No matching events found, mark as synced to prevent blocking
            dao.updateSyncQueueStatus(pendingQueueItems.map { it.id }, "SYNCED")
            return Result.success()
        }

        val isSuccess = ApiClient.syncNotificationEvents(
            serverUrl = serverUrl,
            deviceId = prefs.deviceId,
            token = token,
            events = events
        )

        return if (isSuccess) {
            dao.updateSyncQueueStatus(pendingQueueItems.map { it.id }, "SYNCED")
            Result.success()
        } else {
            pendingQueueItems.forEach { item ->
                dao.recordSyncFailure(item.id)
            }
            if (runAttemptCount < 3) {
                Result.retry()
            } else {
                Result.failure()
            }
        }
    }
}
