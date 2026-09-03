package com.employeemonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class RestartReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Log.d("RestartReceiver", "Restart alarm triggered")

        // Trigger immediate sync when restart alarm fires
        triggerImmediateSync(context)

        if (!MonitoringService.isRunning) {
            val serviceIntent = Intent(context, MonitoringService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                context.startForegroundService(serviceIntent)
            } else {
                context.startService(serviceIntent)
            }
        }
    }

    private fun triggerImmediateSync(context: Context) {
        try {
            val syncRequest = OneTimeWorkRequestBuilder<DataSyncWorker>()
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                "offline_sync_on_restart",
                ExistingWorkPolicy.KEEP,
                syncRequest
            )
            Log.d("RestartReceiver", "Immediate sync work enqueued")
        } catch (e: Exception) {
            Log.e("RestartReceiver", "Failed to enqueue sync work", e)
        }
    }
}
