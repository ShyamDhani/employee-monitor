package com.employeemonitor.db.daos

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.employeemonitor.db.entities.PendingActivityEntity

@Dao
interface PendingActivityDao {
    @Insert
    suspend fun insert(entity: PendingActivityEntity): Long

    @Query("SELECT * FROM pending_activities WHERE synced = 0 ORDER BY timestamp ASC")
    suspend fun getPending(): List<PendingActivityEntity>

    @Query("UPDATE pending_activities SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_activities WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM pending_activities WHERE synced = 1")
    suspend fun deleteSynced()

    @Query("SELECT COUNT(*) FROM pending_activities WHERE synced = 0")
    suspend fun getPendingCount(): Int
}
