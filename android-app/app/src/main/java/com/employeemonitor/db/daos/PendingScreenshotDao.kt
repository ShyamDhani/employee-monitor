package com.employeemonitor.db.daos

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.employeemonitor.db.entities.PendingScreenshotEntity

@Dao
interface PendingScreenshotDao {
    @Insert
    suspend fun insert(entity: PendingScreenshotEntity): Long

    @Query("SELECT * FROM pending_screenshots WHERE synced = 0 ORDER BY timestamp ASC")
    suspend fun getPending(): List<PendingScreenshotEntity>

    @Query("UPDATE pending_screenshots SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_screenshots WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM pending_screenshots WHERE synced = 1")
    suspend fun deleteSynced()

    @Query("SELECT COUNT(*) FROM pending_screenshots WHERE synced = 0")
    suspend fun getPendingCount(): Int
}
