package com.employeemonitor

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Build
import android.os.Bundle
import android.os.IBinder
import android.os.Looper
import android.util.Log
import androidx.core.app.NotificationCompat
import com.employeemonitor.db.OfflineDatabase
import com.employeemonitor.db.entities.PendingLocationEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

class LocationService : Service(), LocationListener {

    companion object {
        private const val TAG = "LocationService"
        private const val CHANNEL_ID = "location_channel"
        private const val NOTIFICATION_ID = 1002
        private const val LOCATION_CHECK_INTERVAL = 30000L
        var isRunning = false
            private set
    }

    private var locationManager: LocationManager? = null
    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var db: OfflineDatabase
    private var locationEnabledAlertSent = false
    private val locationCheckRunnable = object : Runnable {
        override fun run() {
            checkLocationEnabled()
            handler.postDelayed(this, LOCATION_CHECK_INTERVAL)
        }
    }
    private val handler = android.os.Handler(Looper.getMainLooper())

    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .header("bypass-tunnel-reminder", "true")
                .build()
            chain.proceed(request)
        }
        .build()

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        isRunning = true
        db = OfflineDatabase.getInstance(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification("Tracking location"))
        startLocationTracking()
        handler.postDelayed(locationCheckRunnable, LOCATION_CHECK_INTERVAL)
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacks(locationCheckRunnable)
        serviceScope.cancel()
        stopLocationTracking()
        super.onDestroy()
    }

    private fun startLocationTracking() {
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        try {
            locationManager?.requestLocationUpdates(
                LocationManager.GPS_PROVIDER,
                5000L,
                5f,
                this,
                Looper.getMainLooper()
            )
            locationManager?.requestLocationUpdates(
                LocationManager.NETWORK_PROVIDER,
                5000L,
                5f,
                this,
                Looper.getMainLooper()
            )
            Log.d(TAG, "Location tracking started")
        } catch (e: SecurityException) {
            Log.e(TAG, "Location permission not granted", e)
        }
    }

    private fun stopLocationTracking() {
        locationManager?.removeUpdates(this)
    }

    override fun onLocationChanged(location: Location) {
        Log.d(TAG, "Location update: ${location.latitude}, ${location.longitude}")
        sendLocationData(location)
    }

    @Deprecated("Deprecated in Java")
    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}

    override fun onProviderEnabled(provider: String) {
        Log.d(TAG, "Location provider enabled: $provider")
        if (locationEnabledAlertSent) {
            locationEnabledAlertSent = false
            sendLocationStatusAlert("enabled")
        }
    }

    override fun onProviderDisabled(provider: String) {
        Log.w(TAG, "Location provider disabled: $provider")
        if (!locationEnabledAlertSent) {
            locationEnabledAlertSent = true
            sendLocationStatusAlert("disabled")
        }
    }

    private fun checkLocationEnabled() {
        try {
            val lm = locationManager ?: return
            val gpsEnabled = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
            val networkEnabled = lm.isProviderEnabled(LocationManager.NETWORK_PROVIDER)

            if (!gpsEnabled && !networkEnabled && !locationEnabledAlertSent) {
                locationEnabledAlertSent = true
                sendLocationStatusAlert("disabled")
            } else if ((gpsEnabled || networkEnabled) && locationEnabledAlertSent) {
                locationEnabledAlertSent = false
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking location status", e)
        }
    }

    private fun sendLocationStatusAlert(status: String) {
        val empId = DeviceConfig.getEmployeeId(this)
        if (empId.isEmpty()) return

        val title = if (status == "disabled") "Location Disabled" else "Location Re-enabled"
        val message = if (status == "disabled")
            "Employee has turned off location services on their device"
        else
            "Employee has re-enabled location services"

        val json = """{"employee_id":"$empId","timestamp":${System.currentTimeMillis()},"app_package":"location_service","app_name":"Location","type":"location_disabled","severity":"high","title":"$title","message":"$message"}"""

        serviceScope.launch {
            try {
                val id = db.pendingAlertDao().insert(
                    com.employeemonitor.db.entities.PendingAlertEntity(employeeId = empId, payload = json)
                )

                if (DeviceConfig.isNetworkAvailable(this@LocationService)) {
                    val serverUrl = DeviceConfig.getServerUrl(this@LocationService)
                    if (serverUrl.isNotEmpty()) {
                        val body = json.toRequestBody("application/json".toMediaType())
                        val request = Request.Builder()
                            .url("$serverUrl/api/alerts")
                            .post(body)
                            .build()

                        try {
                            client.newCall(request).execute().use { response ->
                                if (response.isSuccessful) {
                                    db.pendingAlertDao().markSynced(id)
                                    Log.d(TAG, "Location status alert sent: $status")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to send location status alert: ${e.message}", e)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer location status alert", e)
            }
        }
    }

    private fun sendLocationData(location: Location) {
        val employeeId = DeviceConfig.getEmployeeId(this)
        if (employeeId.isEmpty()) return

        val json = """
        {
            "employee_id": "$employeeId",
            "timestamp": ${System.currentTimeMillis()},
            "latitude": ${location.latitude},
            "longitude": ${location.longitude},
            "accuracy": ${location.accuracy},
            "altitude": ${location.altitude},
            "speed": ${location.speed},
            "bearing": ${location.bearing}
        }
        """.trimIndent()

        serviceScope.launch {
            try {
                val id = db.pendingLocationDao().insert(
                    PendingLocationEntity(employeeId = employeeId, payload = json)
                )

                if (DeviceConfig.isNetworkAvailable(this@LocationService)) {
                    val serverUrl = DeviceConfig.getServerUrl(this@LocationService)
                    if (serverUrl.isNotEmpty()) {
                        val body = json.toRequestBody("application/json".toMediaType())
                        val request = Request.Builder()
                            .url("$serverUrl/api/location/upload")
                            .post(body)
                            .build()

                        try {
                            client.newCall(request).execute().use { response ->
                                if (response.isSuccessful) {
                                    db.pendingLocationDao().markSynced(id)
                                    Log.d(TAG, "Location sent and synced")
                                }
                            }
                        } catch (e: Exception) {
                            Log.e(TAG, "Failed to send location: ${e.message}", e)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer location", e)
            }
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(CHANNEL_ID, "Location Tracking", NotificationManager.IMPORTANCE_LOW)
            channel.description = "Employee location tracking"
            val nm = getSystemService(NotificationManager::class.java)
            nm.createNotificationChannel(channel)
        }
    }

    private fun createNotification(text: String) = NotificationCompat.Builder(this, CHANNEL_ID)
        .setContentTitle("Location Tracker")
        .setContentText(text)
        .setSmallIcon(android.R.drawable.ic_menu_mylocation)
        .setOngoing(true)
        .setPriority(NotificationCompat.PRIORITY_LOW)
        .build()
}
