package com.employeemonitor.db.daos

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import com.employeemonitor.db.entities.PendingLocationEntity

@Dao
interface PendingLocationDao {
    @Insert
    suspend fun insert(entity: PendingLocationEntity): Long

    @Query("SELECT * FROM pending_locations WHERE synced = 0 ORDER BY timestamp ASC")
    suspend fun getPending(): List<PendingLocationEntity>

    @Query("UPDATE pending_locations SET synced = 1 WHERE id = :id")
    suspend fun markSynced(id: Long)

    @Query("DELETE FROM pending_locations WHERE id = :id")
    suspend fun deleteById(id: Long)

    @Query("DELETE FROM pending_locations WHERE synced = 1")
    suspend fun deleteSynced()

    @Query("SELECT COUNT(*) FROM pending_locations WHERE synced = 0")
    suspend fun getPendingCount(): Int
}
