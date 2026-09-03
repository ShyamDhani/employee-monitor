package com.employeemonitor.db.daos

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.employeemonitor.db.entities.PendingAlertEntity

@Dao
interface PendingAlertDao {
    @Insert
    suspend fun insert(entity: PendingAlertEntity): Long

    @Query("SELECT * FROM pending_alerts WHERE synced = 0 ORDER BY timestamp ASC")
    suspend fun getPending(): List<PendingAlertEntity>

    @Query("UPDATE pending_alerts SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_alerts WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM pending_alerts WHERE synced = 1")
    suspend fun deleteSynced()

    @Query("SELECT COUNT(*) FROM pending_alerts WHERE synced = 0")
    suspend fun getPendingCount(): Int
}
