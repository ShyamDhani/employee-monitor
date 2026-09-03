package com.employeemonitor

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.employeemonitor.db.OfflineDatabase
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class DataSyncWorker(
    context: Context,
    params: WorkerParameters
) : CoroutineWorker(context, params) {

    companion object {
        private const val TAG = "DataSyncWorker"
        const val PERIODIC_WORK_NAME = "offline_sync_periodic"
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .header("bypass-tunnel-reminder", "true")
                .header("ngrok-skip-browser-warning", "true")
                .build()
            chain.proceed(request)
        }
        .build()

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        val db = OfflineDatabase.getInstance(applicationContext)
        val serverUrl = DeviceConfig.getServerUrl(applicationContext)

        if (serverUrl.isEmpty()) {
            Log.w(TAG, "No server URL configured, skipping sync")
            return@withContext Result.success()
        }

        var totalSynced = 0
        var totalFailed = 0

        try {
            // Sync pending activities
            val pendingActivities = db.pendingActivityDao().getPending()
            Log.d(TAG, "Found ${pendingActivities.size} pending activities")
            for (activity in pendingActivities) {
                try {
                    val success = sendToServer(serverUrl, "/api/activity/upload", activity.payload)
                    if (success) {
                        db.pendingActivityDao().markSynced(activity.id)
                        totalSynced++
                    } else {
                        totalFailed++
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to sync activity ${activity.id}", e)
                    totalFailed++
                }
            }

            // Sync pending screenshots (skip large payloads if too many)
            val pendingScreenshots = db.pendingScreenshotDao().getPending()
            Log.d(TAG, "Found ${pendingScreenshots.size} pending screenshots")
            for (screenshot in pendingScreenshots) {
                try {
                    val success = sendToServer(serverUrl, "/api/screenshot/upload", screenshot.payload)
                    if (success) {
                        db.pendingScreenshotDao().markSynced(screenshot.id)
                        totalSynced++
                    } else {
                        totalFailed++
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to sync screenshot ${screenshot.id}", e)
                    totalFailed++
                }
            }

            // Sync pending locations
            val pendingLocations = db.pendingLocationDao().getPending()
            Log.d(TAG, "Found ${pendingLocations.size} pending locations")
            for (location in pendingLocations) {
                try {
                    val success = sendToServer(serverUrl, "/api/location/upload", location.payload)
                    if (success) {
                        db.pendingLocationDao().markSynced(location.id)
                        totalSynced++
                    } else {
                        totalFailed++
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to sync location ${location.id}", e)
                    totalFailed++
                }
            }

            // Sync pending alerts
            val pendingAlerts = db.pendingAlertDao().getPending()
            Log.d(TAG, "Found ${pendingAlerts.size} pending alerts")
            for (alert in pendingAlerts) {
                try {
                    val success = sendToServer(serverUrl, "/api/alerts", alert.payload)
                    if (success) {
                        db.pendingAlertDao().markSynced(alert.id)
                        totalSynced++
                    } else {
                        totalFailed++
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to sync alert ${alert.id}", e)
                    totalFailed++
                }
            }

            // Clean up old synced items (older than 24 hours)
            cleanupSyncedItems(db)

            Log.d(TAG, "Sync complete: $totalSynced synced, $totalFailed failed")

            if (totalFailed > 0) {
                Result.retry()
            } else {
                Result.success()
            }

        } catch (e: Exception) {
            Log.e(TAG, "Sync worker failed", e)
            Result.retry()
        }
    }

    private fun sendToServer(serverUrl: String, endpoint: String, payload: String): Boolean {
        return try {
            val body = payload.toRequestBody("application/json".toMediaType())
            val request = Request.Builder()
                .url("$serverUrl$endpoint")
                .post(body)
                .build()

            val response = client.newCall(request).execute()
            val success = response.isSuccessful
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "HTTP request failed for $endpoint: ${e.message}")
            false
        }
    }

    private suspend fun cleanupSyncedItems(db: OfflineDatabase) {
        try {
            db.pendingActivityDao().deleteSynced()
            db.pendingScreenshotDao().deleteSynced()
            db.pendingLocationDao().deleteSynced()
            db.pendingAlertDao().deleteSynced()
            Log.d(TAG, "Cleaned up synced items")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to cleanup synced items", e)
        }
    }
}
