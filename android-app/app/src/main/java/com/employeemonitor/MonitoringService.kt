package com.employeemonitor

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.BatteryManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Base64
import android.util.DisplayMetrics
import android.util.Log
import android.view.WindowManager
import androidx.core.app.NotificationCompat
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import com.employeemonitor.db.OfflineDatabase
import com.employeemonitor.db.entities.PendingActivityEntity
import com.employeemonitor.db.entities.PendingAlertEntity
import com.employeemonitor.db.entities.PendingScreenshotEntity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit

class MonitoringService : Service() {

    companion object {
        private const val TAG = "MonitorSvc"
        private const val CHANNEL_ID = "monitor_channel"
        private const val NOTIFICATION_ID = 1001
        private const val SCREENCAST_PORT = 8080
        private const val PREFS_NAME = "monitor_projection"
        private const val KEY_RESULT_CODE = "result_code"

        var isRunning = false
            private set
        const val SCREENSHOT_NOT_SET = 0
        var screenshotResultCode = SCREENSHOT_NOT_SET
        var screenshotData: Intent? = null
    }

    private var mediaProjection: MediaProjection? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var imageReader: ImageReader? = null
    private val handler = Handler(Looper.getMainLooper())
    private var wakeLock: PowerManager.WakeLock? = null
    private var cameraCapture: CameraCapture? = null
    private var audioRecorder: AudioRecorder? = null
    private var screenCaster: ScreenCaster? = null
    private var screenshotSetupDone = false
    private var cameraThread: HandlerThread? = null
    private var cameraHandler: Handler? = null

    private var currentAppPackage = ""
    private var currentAppName = ""
    private var appStartTime = 0L
    private var currentBatteryLevel = 100
    private var lowBatteryAlertSent = false
    private var lastAlertTime = 0L
    private val alertCooldownMs = 5000L

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var db: OfflineDatabase

    private val client by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .retryOnConnectionFailure(true)
            .addInterceptor { chain ->
                val request = chain.request().newBuilder()
                    .header("bypass-tunnel-reminder", "true")
                    .build()
                chain.proceed(request)
            }
            .build()
    }

    // ====== PERSIST PROJECTION DATA ======

    private fun persistProjectionData() {
        if (screenshotResultCode == -1 || screenshotData == null) return
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            prefs.edit()
                .putInt(KEY_RESULT_CODE, screenshotResultCode)
                .putString("result_data_uri", screenshotData?.toUri(0))
                .apply()
            Log.d(TAG, "Projection data persisted OK")
        } catch (e: Exception) {
            Log.e(TAG, "persistProjectionData FAILED", e)
        }
    }

    private fun restoreProjectionData(): Boolean {
        if (screenshotResultCode != -1 && screenshotData != null) return true
        try {
            val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val code = prefs.getInt(KEY_RESULT_CODE, -1)
            val uri = prefs.getString("result_data_uri", null)
            if (code != -1 && uri != null) {
                val data = Intent.parseUri(uri, 0)
                screenshotResultCode = code
                screenshotData = data
                Log.d(TAG, "Projection data restored OK from prefs")
                return true
            }
        } catch (e: Exception) {
            Log.e(TAG, "restoreProjectionData FAILED", e)
        }
        return false
    }

    // ====== RUNNABLES ======

    private val activityCheckRunnable = object : Runnable {
        override fun run() {
            try { checkForegroundApp() } catch (e: Exception) { Log.e(TAG, "Error checking app", e) }
            handler.postDelayed(this, 3000)
        }
    }

    private val sendDataRunnable = object : Runnable {
        override fun run() {
            try { sendCurrentSession() } catch (e: Exception) { Log.e(TAG, "Error sending data", e) }
            handler.postDelayed(this, 10000)
        }
    }

    private val screenshotRunnable = object : Runnable {
        override fun run() {
            try {
                if (!screenshotSetupDone) {
                    setupScreenshot()
                }
                if (screenshotSetupDone) {
                    captureScreenshot()
                } else {
                    Log.w(TAG, "Screenshot skipped: no projection")
                }
            } catch (e: Exception) {
                Log.e(TAG, "Error screenshot", e)
                screenshotSetupDone = false
            }
            handler.postDelayed(this, 30000)
        }
    }

    private val commandPollRunnable = object : Runnable {
        override fun run() {
            try { pollCommands() } catch (e: Exception) { Log.e(TAG, "Error polling", e) }
            handler.postDelayed(this, 5000)
        }
    }

    private val batteryCheckRunnable = object : Runnable {
        override fun run() {
            try { checkBatteryLevel() } catch (e: Exception) { Log.e(TAG, "Error battery", e) }
            handler.postDelayed(this, 15000)
        }
    }

    private val restartRunnable = Runnable {
        if (!isRunning) {
            try {
                val intent = Intent(this, MonitoringService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
            } catch (e: Exception) { Log.e(TAG, "Restart failed", e) }
        }
    }

    private val pendingCountRunnable = object : Runnable {
        override fun run() {
            try { updatePendingCount() } catch (e: Exception) { Log.e(TAG, "Error updating count", e) }
            handler.postDelayed(this, 30000)
        }
    }

    // ====== LIFECYCLE ======

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        createNotificationChannel()
        acquireWakeLock()
        isRunning = true
        setupBlockedAppListener()
        startCameraThread()
        db = OfflineDatabase.getInstance(this)
        schedulePeriodicSync()
        Log.d(TAG, "=== SERVICE CREATED ===")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        checkBatteryLevel()

        val intentCode = intent?.getIntExtra("result_code", -1) ?: -1
        val intentData = intent?.getParcelableExtra<Intent>("result_data")
        if (intentCode != -1 && intentData != null) {
            screenshotResultCode = intentCode
            screenshotData = intentData
            Log.d(TAG, "Got projection data from intent")
        }

        restoreProjectionData()
        persistProjectionData()

        Log.d(TAG, "=== SERVICE STARTED === code=$screenshotResultCode hasData=${screenshotData != null} setup=$screenshotSetupDone")

        if (!screenshotSetupDone) {
            setupScreenshot()
        }

        val notifText = if (screenshotSetupDone) "Monitoring | Battery: $currentBatteryLevel%"
            else "Monitoring (no screen capture) | Battery: $currentBatteryLevel%"
        startForeground(NOTIFICATION_ID, createNotification(notifText))

        startLocationService()
        startScreenCaster()

        handler.removeCallbacks(activityCheckRunnable)
        handler.removeCallbacks(sendDataRunnable)
        handler.removeCallbacks(screenshotRunnable)
        handler.removeCallbacks(commandPollRunnable)
        handler.removeCallbacks(batteryCheckRunnable)
        handler.removeCallbacks(pendingCountRunnable)

        handler.postDelayed(activityCheckRunnable, 1000)
        handler.postDelayed(sendDataRunnable, 5000)
        handler.postDelayed(screenshotRunnable, 3000)
        handler.postDelayed(commandPollRunnable, 3000)
        handler.postDelayed(batteryCheckRunnable, 2000)
        handler.postDelayed(pendingCountRunnable, 5000)

        scheduleRestart()
        return START_STICKY
    }

    override fun onDestroy() {
        isRunning = false
        handler.removeCallbacksAndMessages(null)
        serviceScope.cancel()
        try { mediaProjection?.stop() } catch (_: Exception) {}
        try { virtualDisplay?.release() } catch (_: Exception) {}
        try { imageReader?.close() } catch (_: Exception) {}
        try { screenCaster?.stop(); screenCaster = null } catch (_: Exception) {}
        stopCameraThread()
        releaseWakeLock()
        scheduleRestart()
        super.onDestroy()
    }

    override fun onTaskRemoved(rootIntent: Intent?) {
        super.onTaskRemoved(rootIntent)
        scheduleRestart()
    }

    // ====== PERIODIC SYNC ======

    private fun schedulePeriodicSync() {
        val syncRequest = PeriodicWorkRequestBuilder<DataSyncWorker>(15, java.util.concurrent.TimeUnit.MINUTES)
            .build()

        WorkManager.getInstance(this).enqueueUniquePeriodicWork(
            DataSyncWorker.PERIODIC_WORK_NAME,
            ExistingPeriodicWorkPolicy.KEEP,
            syncRequest
        )
        Log.d(TAG, "Periodic sync work scheduled")
    }

    private fun updatePendingCount() {
        serviceScope.launch {
            try {
                val actCount = db.pendingActivityDao().getPendingCount()
                val ssCount = db.pendingScreenshotDao().getPendingCount()
                val locCount = db.pendingLocationDao().getPendingCount()
                val alertCount = db.pendingAlertDao().getPendingCount()
                val total = actCount + ssCount + locCount + alertCount

                handler.post {
                    val notifText = if (total > 0) {
                        "Monitoring | $total pending | Battery: $currentBatteryLevel%"
                    } else if (screenshotSetupDone) {
                        "Monitoring | Battery: $currentBatteryLevel%"
                    } else {
                        "Monitoring (no screen capture) | Battery: $currentBatteryLevel%"
                    }
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIFICATION_ID, createNotification(notifText))
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to get pending count", e)
            }
        }
    }

    // ====== CAMERA THREAD ======

    private fun startCameraThread() {
        if (cameraThread == null) {
            cameraThread = HandlerThread("CameraThread").also { it.start() }
            cameraHandler = Handler(cameraThread!!.looper)
        }
    }

    private fun stopCameraThread() {
        cameraThread?.quitSafely()
        try { cameraThread?.join(1000) } catch (_: Exception) {}
        cameraThread = null
        cameraHandler = null
    }

    // ====== SCREENSHOT ======

    private fun setupScreenshot() {
        restoreProjectionData()
        val resultCode = screenshotResultCode
        val data = screenshotData
        Log.d(TAG, "setupScreenshot: code=$resultCode data=${data != null} setupDone=$screenshotSetupDone")
        if (resultCode == -1 || data == null) {
            Log.w(TAG, "setupScreenshot: no projection data")
            return
        }

        try {
            val pm = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            val projection = pm.getMediaProjection(resultCode, data)
            if (projection == null) {
                Log.e(TAG, "setupScreenshot: getMediaProjection returned NULL - token may be stale")
                screenshotSetupDone = false
                screenshotResultCode = -1
                screenshotData = null
                return
            }

            mediaProjection?.stop()
            mediaProjection = projection

            val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
            val metrics = DisplayMetrics()
            @Suppress("DEPRECATION")
            wm.defaultDisplay.getRealMetrics(metrics)

            val width = 720
            val height = (width.toFloat() / metrics.widthPixels * metrics.heightPixels).toInt()

            imageReader?.close()
            imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)

            virtualDisplay?.release()
            virtualDisplay = projection.createVirtualDisplay(
                "EmpMonitor", width, height, metrics.densityDpi,
                DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
                imageReader?.surface, null, null
            )

            if (virtualDisplay != null) {
                screenshotSetupDone = true
                Log.d(TAG, "Screenshot setup OK: ${width}x${height}")
                handler.post {
                    val nm = getSystemService(NotificationManager::class.java)
                    nm.notify(NOTIFICATION_ID, createNotification("Monitoring | Battery: $currentBatteryLevel%"))
                }
            } else {
                Log.e(TAG, "setupScreenshot: createVirtualDisplay returned NULL")
                screenshotSetupDone = false
            }

            projection.registerCallback(object : MediaProjection.Callback() {
                override fun onStop() {
                    Log.w(TAG, "MediaProjection STOPPED by system")
                    screenshotSetupDone = false
                    handler.post {
                        try { virtualDisplay?.release() } catch (_: Exception) {}
                        virtualDisplay = null
                        try { imageReader?.close() } catch (_: Exception) {}
                        imageReader = null
                        val nm = getSystemService(NotificationManager::class.java)
                        nm.notify(NOTIFICATION_ID, createNotification("Monitoring (no screen capture) | Battery: $currentBatteryLevel%"))
                    }
                }
            }, handler)

        } catch (e: SecurityException) {
            Log.e(TAG, "setupScreenshot: SecurityException - permission revoked", e)
            screenshotSetupDone = false
        } catch (e: Exception) {
            Log.e(TAG, "setupScreenshot: FAILED", e)
            screenshotSetupDone = false
        }
    }

    private fun captureScreenshot() {
        val reader = imageReader ?: run {
            Log.w(TAG, "captureScreenshot: imageReader is null")
            screenshotSetupDone = false
            return
        }
        val proj = mediaProjection ?: run {
            Log.w(TAG, "captureScreenshot: mediaProjection is null")
            screenshotSetupDone = false
            return
        }

        try {
            val image = reader.acquireLatestImage()
            if (image == null) {
                Log.w(TAG, "captureScreenshot: acquireLatestImage returned null")
                return
            }
            val w = image.width
            val h = image.height
            val plane = image.planes[0]
            val buffer = plane.buffer
            val pixelStride = plane.pixelStride
            val rowStride = plane.rowStride
            val rowPadding = rowStride - pixelStride * w

            val bmp = Bitmap.createBitmap(w + rowPadding / pixelStride, h, Bitmap.Config.ARGB_8888)
            bmp.copyPixelsFromBuffer(buffer)
            image.close()

            val cropped = Bitmap.createBitmap(bmp, 0, 0, w, h)
            if (cropped != bmp) bmp.recycle()

            val out = ByteArrayOutputStream()
            cropped.compress(Bitmap.CompressFormat.JPEG, 60, out)
            cropped.recycle()

            val jpegBytes = out.toByteArray()
            val base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
            Log.d(TAG, "Screenshot captured: ${jpegBytes.size} bytes")
            sendScreenshot(base64, w, h)
            screenCaster?.broadcast(jpegBytes)
        } catch (e: Exception) {
            Log.e(TAG, "captureScreenshot FAILED", e)
            screenshotSetupDone = false
        }
    }

    private fun sendScreenshot(base64: String, w: Int, h: Int) {
        val empId = DeviceConfig.getEmployeeId(this)
        if (empId.isEmpty()) return

        val json = """{"employee_id":"$empId","timestamp":${System.currentTimeMillis()},"image_base64":"$base64","app_package":"$currentAppPackage","app_name":"$currentAppName","width":$w,"height":$h,"battery_level":$currentBatteryLevel}"""

        serviceScope.launch {
            try {
                val id = db.pendingScreenshotDao().insert(
                    PendingScreenshotEntity(employeeId = empId, payload = json)
                )
                Log.d(TAG, "Screenshot buffered to DB: $id")

                if (DeviceConfig.isNetworkAvailable(this@MonitoringService)) {
                    val success = sendToServer("/api/screenshot/upload", json)
                    if (success) {
                        db.pendingScreenshotDao().markSynced(id)
                        Log.d(TAG, "Screenshot sent and marked synced")
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer screenshot", e)
            }
        }
    }

    // ====== SCREEN CASTING ======

    private fun startScreenCaster() {
        try {
            if (screenCaster == null) {
                screenCaster = ScreenCaster()
            }
            if (!screenCaster!!.isRunning()) {
                screenCaster?.start(SCREENCAST_PORT)
                Log.d(TAG, "ScreenCaster started on port $SCREENCAST_PORT")
            }
        } catch (e: Exception) {
            Log.e(TAG, "ScreenCaster start FAILED", e)
        }
    }

    // ====== COMMANDS ======

    private fun pollCommands() {
        val serverUrl = DeviceConfig.getServerUrl(this)
        val empId = DeviceConfig.getEmployeeId(this)
        if (serverUrl.isEmpty() || empId.isEmpty()) return

        val request = Request.Builder().url("$serverUrl/api/settings/commands/$empId").get().build()
        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e(TAG, "Command poll failed: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                try {
                    val body = response.body?.string()
                    if (response.isSuccessful && body != null) {
                        val json = JSONObject(body)
                        if (json.getBoolean("success")) {
                            val commands = json.getJSONArray("commands")
                            for (i in 0 until commands.length()) {
                                val cmd = commands.getJSONObject(i)
                                handler.post { handleCommand(cmd.getString("command"), cmd.optJSONObject("data")) }
                            }
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Parse commands error: ${e.message}")
                } finally { response.close() }
            }
        })
    }

    fun handleCommand(command: String, data: JSONObject? = null) {
        Log.d(TAG, ">>> COMMAND: $command")
        when (command) {
            "capture_camera" -> {
                cameraHandler?.post {
                    try {
                        Log.d(TAG, "Starting camera capture on camera thread...")
                        val cam = CameraCapture(this@MonitoringService)
                        cam.capturePhoto { success, msg ->
                            Log.d(TAG, "Camera result: $success - $msg")
                        }
                    } catch (e: Exception) {
                        Log.e(TAG, "Camera capture FAILED", e)
                    }
                } ?: Log.e(TAG, "Camera thread not available")
            }
            "capture_screenshot" -> {
                if (!screenshotSetupDone) setupScreenshot()
                if (screenshotSetupDone) captureScreenshot()
                else Log.e(TAG, "Cannot screenshot: not set up")
            }
            "record_audio" -> {
                val dur = data?.optInt("duration", 10) ?: 10
                audioRecorder = AudioRecorder(DeviceConfig.getServerUrl(this), DeviceConfig.getEmployeeId(this))
                audioRecorder?.startRecording(dur) { ok, msg -> Log.d(TAG, "Audio: $ok - $msg") }
            }
            "track_location" -> startLocationService()
        }
    }

    // ====== APP TRACKING ======

    private fun checkForegroundApp() {
        try {
            val now = System.currentTimeMillis()
            var pkg = ""
            var name = ""

            val fg = ForegroundService.getInstance()
            if (fg != null && ForegroundService.currentPackage.isNotEmpty()) {
                pkg = ForegroundService.currentPackage
                name = getAppName(pkg)
            }

            if (pkg.isEmpty()) {
                try {
                    val usm = getSystemService(Context.USAGE_STATS_SERVICE) as android.app.usage.UsageStatsManager
                    val stats = usm.queryUsageStats(android.app.usage.UsageStatsManager.INTERVAL_DAILY, now - 120000, now)
                    if (!stats.isNullOrEmpty()) {
                        val top = stats.maxByOrNull { it.lastTimeUsed }
                        pkg = top?.packageName ?: ""
                        name = getAppName(pkg)
                    }
                } catch (e: SecurityException) { }
            }

            if (pkg.isEmpty()) return

            if (currentAppPackage.isEmpty()) {
                currentAppPackage = pkg
                currentAppName = name
                appStartTime = now
            } else if (pkg != currentAppPackage) {
                val duration = now - appStartTime
                if (duration > 1000 && currentAppPackage.isNotEmpty()) {
                    sendActivityUpdate(currentAppPackage, currentAppName, appStartTime, now, duration)
                }
                currentAppPackage = pkg
                currentAppName = name
                appStartTime = now
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error checking app", e)
        }
    }

    private fun getAppName(packageName: String): String {
        return try {
            val info = packageManager.getApplicationInfo(packageName, 0)
            val label = packageManager.getApplicationLabel(info).toString()
            if (label.isNotEmpty()) label else packageName
        } catch (e: Exception) {
            packageName.substringAfterLast('.')
        }
    }

    // ====== DATA SENDING ======

    private fun sendCurrentSession() {
        if (currentAppPackage.isEmpty()) return
        val now = System.currentTimeMillis()
        sendActivityUpdate(currentAppPackage, currentAppName, appStartTime, now, now - appStartTime)
    }

    private fun sendActivityUpdate(pkg: String, name: String, start: Long, end: Long, durationMs: Long) {
        val empId = DeviceConfig.getEmployeeId(this)
        if (empId.isEmpty()) return

        val fmt = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSSZ", java.util.Locale.US)
        val startIso = fmt.format(java.util.Date(start))
        val endIso = fmt.format(java.util.Date(end))

        val json = """{"employee_id":"$empId","timestamp":"$startIso","app_package":"$pkg","app_name":"$name","duration_ms":$durationMs,"start_time":"$startIso","end_time":"$endIso","battery_level":$currentBatteryLevel}"""

        serviceScope.launch {
            try {
                val id = db.pendingActivityDao().insert(
                    PendingActivityEntity(employeeId = empId, payload = json)
                )

                if (DeviceConfig.isNetworkAvailable(this@MonitoringService)) {
                    val success = sendToServer("/api/activity/upload", json)
                    if (success) {
                        db.pendingActivityDao().markSynced(id)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer activity", e)
            }
        }
    }

    private fun sendToServer(endpoint: String, jsonPayload: String): Boolean {
        return try {
            val serverUrl = DeviceConfig.getServerUrl(this)
            if (serverUrl.isEmpty()) return false

            val body = jsonPayload.toRequestBody("application/json".toMediaType())
            val request = Request.Builder().url("$serverUrl$endpoint").post(body).build()

            val response = client.newCall(request).execute()
            val success = response.isSuccessful
            response.close()
            success
        } catch (e: Exception) {
            Log.e(TAG, "HTTP request failed for $endpoint: ${e.message}")
            false
        }
    }

    // ====== BATTERY ======

    private fun checkBatteryLevel() {
        try {
            val bi = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = bi?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = bi?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            val status = bi?.getIntExtra(BatteryManager.EXTRA_STATUS, -1) ?: -1
            val isCharging = status == BatteryManager.BATTERY_STATUS_CHARGING || status == BatteryManager.BATTERY_STATUS_FULL
            if (level == -1 || scale == -1) return

            currentBatteryLevel = (level * 100) / scale
            if (currentBatteryLevel <= 4 && !isCharging && !lowBatteryAlertSent) {
                lowBatteryAlertSent = true
                sendLowBatteryAlert(currentBatteryLevel)
            }
            if (currentBatteryLevel > 4) lowBatteryAlertSent = false
        } catch (e: Exception) { Log.e(TAG, "Battery error", e) }
    }

    private fun sendLowBatteryAlert(batteryLevel: Int) {
        val empId = DeviceConfig.getEmployeeId(this)
        if (empId.isEmpty()) return
        val json = """{"employee_id":"$empId","timestamp":${System.currentTimeMillis()},"app_package":"system","app_name":"Battery","type":"device_offline","severity":"high","title":"Low Battery Warning","message":"Device battery is at $batteryLevel%. Monitoring may stop soon."}"""

        serviceScope.launch {
            try {
                val id = db.pendingAlertDao().insert(
                    PendingAlertEntity(employeeId = empId, payload = json)
                )

                if (DeviceConfig.isNetworkAvailable(this@MonitoringService)) {
                    val success = sendToServer("/api/alerts", json)
                    if (success) {
                        db.pendingAlertDao().markSynced(id)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer low battery alert", e)
            }
        }
    }

    // ====== BLOCKED APPS ======

    private fun setupBlockedAppListener() {
        ForegroundService.onBlockedAppDetected = { packageName, appName ->
            val now = System.currentTimeMillis()
            if (now - lastAlertTime >= alertCooldownMs) {
                lastAlertTime = now
                handler.post {
                    if (!screenshotSetupDone) setupScreenshot()
                    if (screenshotSetupDone) captureScreenshot()
                    sendBlockedAppAlert(packageName, appName)
                }
            }
        }
    }

    private fun sendBlockedAppAlert(packageName: String, appName: String) {
        val empId = DeviceConfig.getEmployeeId(this)
        if (empId.isEmpty()) return
        val json = """{"employee_id":"$empId","timestamp":${System.currentTimeMillis()},"app_package":"$packageName","app_name":"$appName","type":"unauthorized_app","severity":"high","title":"Unprofessional App Detected","message":"Employee opened $appName which is on the blocked list"}"""

        serviceScope.launch {
            try {
                val id = db.pendingAlertDao().insert(
                    PendingAlertEntity(employeeId = empId, payload = json)
                )

                if (DeviceConfig.isNetworkAvailable(this@MonitoringService)) {
                    val success = sendToServer("/api/alerts", json)
                    if (success) {
                        db.pendingAlertDao().markSynced(id)
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to buffer blocked app alert", e)
            }
        }
    }

    // ====== LOCATION ======

    private fun startLocationService() {
        try {
            val intent = Intent(this, LocationService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) startForegroundService(intent) else startService(intent)
        } catch (e: Exception) { Log.e(TAG, "Location start failed", e) }
    }

    // ====== RESTART ======

    private fun scheduleRestart() {
        handler.removeCallbacks(restartRunnable)
        handler.postDelayed(restartRunnable, 10000)
        try {
            val am = getSystemService(Context.ALARM_SERVICE) as AlarmManager
            val intent = Intent(this, RestartReceiver::class.java)
            val pi = PendingIntent.getBroadcast(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            am.setRepeating(AlarmManager.RTC_WAKEUP, System.currentTimeMillis() + 120000, 120000, pi)
        } catch (e: Exception) { }
    }

    // ====== NOTIFICATION ======

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "Monitoring", NotificationManager.IMPORTANCE_HIGH)
            ch.description = "Activity monitoring"
            ch.lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
            getSystemService(NotificationManager::class.java).createNotificationChannel(ch)
        }
    }

    private fun createNotification(text: String): android.app.Notification {
        val builder = NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Employee Monitor").setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_info_details)
            .setOngoing(true).setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)

        if (!screenshotSetupDone) {
            val openAppIntent = Intent(this, MainActivity::class.java).apply {
                putExtra("REQUEST_SCREENSHOT", true)
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            val pending = PendingIntent.getActivity(
                this, 9999, openAppIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            builder.setContentText("Screen capture needed - Tap to grant")
            builder.setFullScreenIntent(pending, true)
            builder.addAction(android.R.drawable.ic_menu_camera, "Grant Screen Capture", pending)
        }

        return builder.build()
    }

    private fun acquireWakeLock() {
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Monitor::Wake").apply { acquire(24 * 3600 * 1000L) }
    }

    private fun releaseWakeLock() {
        wakeLock?.let { if (it.isHeld) it.release() }
        wakeLock = null
    }
}
