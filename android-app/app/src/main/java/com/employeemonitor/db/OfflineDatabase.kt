package com.employeemonitor.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import com.employeemonitor.db.daos.PendingActivityDao
import com.employeemonitor.db.daos.PendingAlertDao
import com.employeemonitor.db.daos.PendingLocationDao
import com.employeemonitor.db.daos.PendingScreenshotDao
import com.employeemonitor.db.entities.PendingActivityEntity
import com.employeemonitor.db.entities.PendingAlertEntity
import com.employeemonitor.db.entities.PendingLocationEntity
import com.employeemonitor.db.entities.PendingScreenshotEntity

@Database(
    entities = [
        PendingActivityEntity::class,
        PendingScreenshotEntity::class,
        PendingLocationEntity::class,
        PendingAlertEntity::class
    ],
    version = 1,
    exportSchema = true
)
abstract class OfflineDatabase : RoomDatabase() {

    abstract fun pendingActivityDao(): PendingActivityDao
    abstract fun pendingScreenshotDao(): PendingScreenshotDao
    abstract fun pendingLocationDao(): PendingLocationDao
    abstract fun pendingAlertDao(): PendingAlertDao

    companion object {
        @Volatile
        private var INSTANCE: OfflineDatabase? = null

        fun getInstance(context: Context): OfflineDatabase {
            return INSTANCE ?: synchronized(this) {
                val instance = Room.databaseBuilder(
                    context.applicationContext,
                    OfflineDatabase::class.java,
                    "employee_monitor_offline.db"
                )
                    .fallbackToDestructiveMigration()
                    .build()
                INSTANCE = instance
                instance
            }
        }
    }
}
