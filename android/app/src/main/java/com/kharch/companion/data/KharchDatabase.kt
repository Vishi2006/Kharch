package com.kharch.companion.data

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.TypeConverters

@Database(
    entities = [ConsentRecord::class, NotificationEvent::class, SyncQueueItem::class],
    version = 1,
    exportSchema = false
)
@TypeConverters(Converters::class)
abstract class KharchDatabase : RoomDatabase() {
    abstract fun kharchDao(): KharchDao

    companion object {
        @Volatile
        private var INSTANCE: KharchDatabase? = null

        fun getDatabase(context: Context): KharchDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    KharchDatabase::class.java,
                    "kharch_companion.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
