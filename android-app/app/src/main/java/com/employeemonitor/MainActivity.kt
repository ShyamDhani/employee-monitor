package com.employeemonitor

import android.Manifest
import android.accessibilityservice.AccessibilityServiceInfo
import android.app.AppOpsManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.media.projection.MediaProjectionManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.util.Log
import android.view.accessibility.AccessibilityManager
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import com.google.android.material.button.MaterialButton

class MainActivity : AppCompatActivity() {

    private lateinit var tvStatus: TextView
    private lateinit var tvInfo: TextView
    private lateinit var tvPermissions: TextView
    private lateinit var btnStart: MaterialButton
    private lateinit var btnUsageStats: MaterialButton
    private lateinit var btnOverlay: MaterialButton
    private lateinit var btnAccessibility: MaterialButton

    private lateinit var devicePolicyManager: DevicePolicyManager
    private lateinit var adminComponent: ComponentName

    private val screenshotLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        if (result.resultCode == android.app.Activity.RESULT_OK && result.data != null) {
            MonitoringService.screenshotResultCode = result.resultCode
            MonitoringService.screenshotData = result.data!!
            val prefs = getSharedPreferences("monitor_projection", Context.MODE_PRIVATE)
            prefs.edit()
                .putInt("result_code", result.resultCode)
                .putString("result_data_uri", result.data!!.toUri(0))
                .apply()
            Log.d("MainActivity", "Projection data saved: code=$result.resultCode")
        } else {
            Log.w("MainActivity", "Screen capture permission DENIED or cancelled")
        }
        startMonitoringService()
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { _ ->
        checkPermissionsAndStart()
    }

    private val usageStatsLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        checkPermissionsAndStart()
    }

    private val overlayLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        checkPermissionsAndStart()
    }

    private val accessibilityLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        checkPermissionsAndStart()
    }

    private val deviceAdminLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) {
        if (devicePolicyManager.isAdminActive(adminComponent)) {
            Toast.makeText(this, "Device Admin activated - uninstall protection enabled", Toast.LENGTH_SHORT).show()
        } else {
            Toast.makeText(this, "Device Admin not activated. App can be uninstalled.", Toast.LENGTH_SHORT).show()
        }
        checkPermissionsAndStart()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        tvStatus = findViewById(R.id.tvStatus)
        tvInfo = findViewById(R.id.tvInfo)
        tvPermissions = findViewById(R.id.tvPermissions)
        btnStart = findViewById(R.id.btnStart)

        devicePolicyManager = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        adminComponent = ComponentName(this, EmployeeAdminReceiver::class.java)

        handleScreenshotRequest(intent)

        val extraLayout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(0, 16, 0, 0)
        }

        btnUsageStats = MaterialButton(this).apply {
            text = "Grant Usage Stats Access"
            setOnClickListener {
                val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
                usageStatsLauncher.launch(intent)
            }
        }

        btnOverlay = MaterialButton(this).apply {
            text = "Grant Overlay Permission"
            setOnClickListener {
                val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
                overlayLauncher.launch(intent)
            }
        }

        btnAccessibility = MaterialButton(this).apply {
            text = "Enable App Detection (Accessibility)"
            setOnClickListener {
                val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
                accessibilityLauncher.launch(intent)
            }
        }

        val btnBattery = MaterialButton(this).apply {
            text = "Disable Battery Optimization"
            setOnClickListener {
                requestBatteryOptimizationExemption()
            }
        }

        val btnServerUrl = MaterialButton(this).apply {
            text = "Configure Server URL"
            setOnClickListener {
                showServerUrlDialog()
            }
        }

        extraLayout.addView(btnUsageStats)
        extraLayout.addView(btnOverlay)
        extraLayout.addView(btnAccessibility)
        extraLayout.addView(btnBattery)
        extraLayout.addView(btnServerUrl)

        val parent = tvPermissions.parent as? android.view.ViewGroup
        parent?.addView(extraLayout, parent.indexOfChild(tvPermissions) + 1)

        btnStart.setOnClickListener {
            if (MonitoringService.isRunning) {
                stopService(Intent(this, MonitoringService::class.java))
                stopService(Intent(this, LocationService::class.java))
                Toast.makeText(this, "Monitoring stopped", Toast.LENGTH_SHORT).show()
                updateUI()
            } else {
                startProcess()
            }
        }

        autoConfigure()
    }

    override fun onResume() {
        super.onResume()
        updateUI()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleScreenshotRequest(intent)
    }

    private fun handleScreenshotRequest(intent: Intent?) {
        if (intent?.getBooleanExtra("REQUEST_SCREENSHOT", false) == true) {
            intent.removeExtra("REQUEST_SCREENSHOT")
            Toast.makeText(this, "Please grant screen capture permission", Toast.LENGTH_LONG).show()
            tryScreenshot()
        }
    }

    private fun showServerUrlDialog() {
        val currentUrl = DeviceConfig.getServerUrl(this)
        val editText = EditText(this).apply {
            setText(currentUrl)
            hint = "http://192.168.1.100:3000"
            setPadding(48, 32, 48, 16)
        }

        AlertDialog.Builder(this)
            .setTitle("Server URL")
            .setMessage("Enter the backend server URL. Use your PC's IP address for local network, or ngrok URL for remote access.")
            .setView(editText)
            .setPositiveButton("Save") { _, _ ->
                val url = editText.text.toString().trim()
                if (url.isNotEmpty()) {
                    DeviceConfig.setServerUrl(this, url)
                    Toast.makeText(this, "Server URL updated: $url", Toast.LENGTH_SHORT).show()
                    autoConfigure()
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun requestBatteryOptimizationExemption() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val powerManager = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (!powerManager.isIgnoringBatteryOptimizations(packageName)) {
                try {
                    val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                        data = Uri.parse("package:$packageName")
                    }
                    startActivity(intent)
                    Toast.makeText(this, "Please allow battery optimization exemption", Toast.LENGTH_LONG).show()
                } catch (e: Exception) {
                    Toast.makeText(this, "Cannot open battery settings", Toast.LENGTH_SHORT).show()
                }
            } else {
                Toast.makeText(this, "Already exempt from battery optimization", Toast.LENGTH_SHORT).show()
            }
        }
    }

    private fun autoConfigure() {
        if (DeviceConfig.isConfigured(this)) {
            tvInfo.text = "Server: ${DeviceConfig.getServerUrl(this)}\nEmployee: ${DeviceConfig.getEmployeeId(this)}"
            updateUI()
        } else {
            tvInfo.text = "Connecting to server..."
            tvStatus.text = "Configuring"
            tvStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_orange_dark))

            DeviceConfig.configureDevice(this) { success, message ->
                runOnUiThread {
                    if (success) {
                        tvInfo.text = "Server: ${DeviceConfig.getServerUrl(this)}\nEmployee: ${DeviceConfig.getEmployeeId(this)}"
                        updateUI()
                    } else {
                        tvInfo.text = "Config failed: $message\nTap 'Configure Server URL' to set the correct URL"
                        tvStatus.text = "Error"
                        tvStatus.setTextColor(ContextCompat.getColor(this, android.R.color.holo_red_dark))
                    }
                }
            }
        }
    }

    private fun startProcess() {
        if (!devicePolicyManager.isAdminActive(adminComponent)) {
            Toast.makeText(this, "Please activate Device Admin to prevent unauthorized uninstallation", Toast.LENGTH_LONG).show()
            val intent = Intent(DevicePolicyManager.ACTION_ADD_DEVICE_ADMIN).apply {
                putExtra(DevicePolicyManager.EXTRA_DEVICE_ADMIN, adminComponent)
                putExtra(DevicePolicyManager.EXTRA_ADD_EXPLANATION, "Device Admin is required to prevent unauthorized uninstallation of the monitoring app.")
            }
            deviceAdminLauncher.launch(intent)
            return
        }

        val perms = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.CAMERA)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.RECORD_AUDIO)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.ACCESS_COARSE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
            perms.add(Manifest.permission.ACCESS_COARSE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                perms.add(Manifest.permission.POST_NOTIFICATIONS)
            }
        }

        if (perms.isNotEmpty()) {
            permissionLauncher.launch(perms.toTypedArray())
        } else {
            checkPermissionsAndStart()
        }
    }

    private fun checkPermissionsAndStart() {
        if (!Settings.canDrawOverlays(this)) {
            Toast.makeText(this, "Please grant Overlay permission", Toast.LENGTH_LONG).show()
            val intent = Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName"))
            overlayLauncher.launch(intent)
            return
        }

        val hasAccessibility = isAccessibilityServiceEnabled()
        val hasUsageStats = hasUsageStatsPermission()

        if (!hasAccessibility && !hasUsageStats) {
            Toast.makeText(this, "Enable App Detection: Accessibility OR Usage Stats", Toast.LENGTH_LONG).show()
            val intent = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS)
            accessibilityLauncher.launch(intent)
            return
        }

        tryScreenshot()
    }

    private fun isAccessibilityServiceEnabled(): Boolean {
        val am = getSystemService(Context.ACCESSIBILITY_SERVICE) as AccessibilityManager
        val enabledServices = am.getEnabledAccessibilityServiceList(AccessibilityServiceInfo.FEEDBACK_GENERIC)
        return enabledServices.any { it.resolveInfo.serviceInfo.name == ForegroundService::class.java.name }
    }

    private fun tryScreenshot() {
        try {
            val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
            screenshotLauncher.launch(projectionManager.createScreenCaptureIntent())
        } catch (e: Exception) {
            startMonitoringService()
        }
    }

    private fun startMonitoringService() {
        val intent = Intent(this, MonitoringService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(intent)
        } else {
            startService(intent)
        }
        Toast.makeText(this, "Monitoring started", Toast.LENGTH_SHORT).show()
        updateUI()
    }

    private fun updateUI() {
        val running = MonitoringService.isRunning
        tvStatus.text = if (running) "Active" else "Stopped"
        tvStatus.setTextColor(ContextCompat.getColor(this, if (running) android.R.color.holo_green_dark else android.R.color.holo_red_dark))
        btnStart.text = if (running) "Stop Monitoring" else "Start Monitoring"

        val granted = mutableListOf<String>()
        val missing = mutableListOf<String>()

        val isAdmin = devicePolicyManager.isAdminActive(adminComponent)
        if (isAdmin) granted.add("Device Admin") else missing.add("Device Admin")

        val hasAccess = isAccessibilityServiceEnabled()
        val hasUsage = hasUsageStatsPermission()
        if (hasAccess) granted.add("App Detection (Accessibility)") else if (hasUsage) granted.add("App Detection (UsageStats)") else missing.add("App Detection")
        if (Settings.canDrawOverlays(this)) granted.add("Overlay") else missing.add("Overlay")
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) granted.add("Camera") else missing.add("Camera")
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) granted.add("Audio") else missing.add("Audio")
        if (ContextCompat.checkSelfPermission(this, android.Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) granted.add("Location") else missing.add("Location")

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
            if (pm.isIgnoringBatteryOptimizations(packageName)) granted.add("Battery Opt Off") else missing.add("Battery Opt Off")
        }

        tvPermissions.text = "Granted: ${granted.joinToString(", ")}\nMissing: ${missing.joinToString(", ")}"

        btnUsageStats.visibility = if (hasUsage) android.view.View.GONE else android.view.View.VISIBLE
        btnOverlay.visibility = if (Settings.canDrawOverlays(this)) android.view.View.GONE else android.view.View.VISIBLE
        btnAccessibility.visibility = if (hasAccess) android.view.View.GONE else android.view.View.VISIBLE
    }

    private fun hasUsageStatsPermission(): Boolean {
        val appOps = getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
        val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            appOps.unsafeCheckOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), packageName)
        } else {
            appOps.checkOpNoThrow(AppOpsManager.OPSTR_GET_USAGE_STATS, android.os.Process.myUid(), packageName)
        }
        return mode == AppOpsManager.MODE_ALLOWED
    }
}
