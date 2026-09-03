package com.employeemonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import java.util.concurrent.TimeUnit

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            Log.d("BootReceiver", "Boot completed, checking auto-start")

            // Start periodic sync worker on boot
            startPeriodicSync(context)

            if (!DeviceConfig.isConfigured(context)) {
                Log.d("BootReceiver", "Device not configured, configuring now")
                DeviceConfig.configureDevice(context) { success, message ->
                    Log.d("BootReceiver", "Configure result: $success - $message")
                    if (success) {
                        startMonitoringService(context)
                    }
                }
            } else {
                Log.d("BootReceiver", "Device already configured, starting service")
                startMonitoringService(context)
            }
        }
    }

    private fun startMonitoringService(context: Context) {
        val serviceIntent = Intent(context, MonitoringService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(serviceIntent)
        } else {
            context.startService(serviceIntent)
        }
        Log.d("BootReceiver", "Monitoring service started")
    }

    private fun startPeriodicSync(context: Context) {
        try {
            val syncRequest = PeriodicWorkRequestBuilder<DataSyncWorker>(15, TimeUnit.MINUTES)
                .build()

            WorkManager.getInstance(context).enqueueUniquePeriodicWork(
                DataSyncWorker.PERIODIC_WORK_NAME,
                ExistingPeriodicWorkPolicy.KEEP,
                syncRequest
            )
            Log.d("BootReceiver", "Periodic sync work scheduled")
        } catch (e: Exception) {
            Log.e("BootReceiver", "Failed to schedule periodic sync", e)
        }
    }
}
