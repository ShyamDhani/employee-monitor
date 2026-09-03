package com.employeemonitor

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.AccessibilityServiceInfo
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.accessibility.AccessibilityEvent

class ForegroundService : AccessibilityService() {

    companion object {
        private const val TAG = "ForegroundService"
        var currentPackage: String = ""
            private set
        var currentClass: String = ""
            private set
        private var instance: ForegroundService? = null

        var onBlockedAppDetected: ((packageName: String, appName: String) -> Unit)? = null

        fun getInstance(): ForegroundService? = instance
        fun isRunning(): Boolean = instance != null
    }

    private val handler = Handler(Looper.getMainLooper())

    override fun onServiceConnected() {
        super.onServiceConnected()
        instance = this
        Log.d(TAG, "AccessibilityService connected")

        serviceInfo = serviceInfo.apply {
            eventTypes = AccessibilityEvent.TYPES_ALL_MASK
            feedbackType = AccessibilityServiceInfo.FEEDBACK_GENERIC
            notificationTimeout = 200
        }
    }

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event == null) return

        val pkg = event.packageName?.toString() ?: return
        val cls = event.className?.toString() ?: ""

        if (pkg == "com.android.systemui" || pkg == this.packageName) return
        if (pkg.isEmpty()) return

        if (pkg != currentPackage || cls != currentClass) {
            currentPackage = pkg
            currentClass = cls
            Log.d(TAG, "Foreground: $pkg")

            if (BlockedApps.isBlocked(pkg)) {
                val appName = BlockedApps.getAppDisplayName(pkg)
                Log.w(TAG, "BLOCKED APP DETECTED: $appName ($pkg)")
                onBlockedAppDetected?.invoke(pkg, appName)
            }
        }
    }

    override fun onInterrupt() {
        Log.d(TAG, "AccessibilityService interrupted")
    }

    override fun onDestroy() {
        instance = null
        super.onDestroy()
    }
}
