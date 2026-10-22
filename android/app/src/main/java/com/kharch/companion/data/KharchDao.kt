package com.kharch.companion.data

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query

@Dao
interface KharchDao {
    // Consent operations
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun saveConsent(consent: ConsentRecord)

    @Query("SELECT * FROM consent_record WHERE id = 1 LIMIT 1")
    suspend fun getConsent(): ConsentRecord?

    @Query("DELETE FROM consent_record")
    suspend fun clearConsent()

    // NotificationEvent operations
    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertNotificationEvent(event: NotificationEvent): Long

    @Query("SELECT * FROM notification_event WHERE idempotencyKey = :key LIMIT 1")
    suspend fun getEventByIdempotencyKey(key: String): NotificationEvent?

    @Query("SELECT * FROM notification_event ORDER BY timestamp DESC LIMIT 1")
    suspend fun getLastNotificationEvent(): NotificationEvent?

    @Query("SELECT COUNT(*) FROM notification_event")
    suspend fun getTotalNotificationCount(): Int

    @Query("DELETE FROM notification_event")
    suspend fun clearAllNotificationEvents()

    // SyncQueue operations
    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertSyncQueueItem(item: SyncQueueItem): Long

    @Query("SELECT * FROM sync_queue WHERE status = 'PENDING' ORDER BY createdAt ASC LIMIT :limit")
    suspend fun getPendingSyncQueueItems(limit: Int = 50): List<SyncQueueItem>

    @Query("SELECT * FROM notification_event WHERE id IN (:ids)")
    suspend fun getEventsByIds(ids: List<Long>): List<NotificationEvent>

    @Query("UPDATE sync_queue SET status = :status WHERE id IN (:ids)")
    suspend fun updateSyncQueueStatus(ids: List<Long>, status: String)

    @Query("UPDATE sync_queue SET retryCount = retryCount + 1, lastAttemptAt = :attemptTime WHERE id = :id")
    suspend fun recordSyncFailure(id: Long, attemptTime: Long = System.currentTimeMillis())

    @Query("SELECT COUNT(*) FROM sync_queue WHERE status = 'PENDING'")
    suspend fun getPendingSyncCount(): Int

    @Query("DELETE FROM sync_queue")
    suspend fun clearSyncQueue()
}
