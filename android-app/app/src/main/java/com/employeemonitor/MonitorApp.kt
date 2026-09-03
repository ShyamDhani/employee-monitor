package com.employeemonitor

import android.app.Application
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.os.Build
import android.util.Log
import androidx.work.Configuration
import androidx.work.WorkManager

class MonitorApp : Application(), Configuration.Provider {

    companion object {
        private const val TAG = "MonitorApp"
        var isDeviceOwner = false
            private set
    }

    override fun onCreate() {
        super.onCreate()
        checkDeviceOwner()
        if (isDeviceOwner) {
            applyDeviceOwnerPolicies()
        }

        // Initialize connectivity monitor
        ConnectivityMonitor.getInstance(this).startMonitoring()
    }

    override val workManagerConfiguration: Configuration
        get() = Configuration.Builder()
            .setMinimumLoggingLevel(android.util.Log.INFO)
            .build()

    private fun checkDeviceOwner() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this, AdminReceiver::class.java)
            isDeviceOwner = dpm.isDeviceOwnerApp(packageName)
            Log.d(TAG, "Device Owner check: $isDeviceOwner")
        } catch (e: Exception) {
            Log.e(TAG, "Device Owner check failed", e)
            isDeviceOwner = false
        }
    }

    private fun applyDeviceOwnerPolicies() {
        try {
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this, AdminReceiver::class.java)

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                dpm.setKeyguardDisabled(admin, true)
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
            }

            Log.d(TAG, "Device Owner policies applied")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to apply Device Owner policies", e)
        }
    }
}
