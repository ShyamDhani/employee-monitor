package com.employeemonitor.db.entities

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "pending_alerts")
data class PendingAlertEntity(
    @PrimaryKey(autoGenerate = true)
    val id: Long = 0,
    val employeeId: String,
    val payload: String,
    val timestamp: Long = System.currentTimeMillis(),
    val synced: Boolean = false
)
