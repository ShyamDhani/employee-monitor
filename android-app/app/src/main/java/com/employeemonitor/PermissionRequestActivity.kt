package com.employeemonitor

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.Bundle
import android.util.Log

class PermissionRequestActivity : Activity() {

    companion object {
        private const val TAG = "PermissionRequest"
        private const val REQUEST_MEDIA_PROJECTION = 1001
        const val EXTRA_AUTO_CAST = "auto_cast"

        fun createIntent(context: Context, autoCast: Boolean): Intent {
            return Intent(context, PermissionRequestActivity::class.java)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                .putExtra(EXTRA_AUTO_CAST, autoCast)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Log.d(TAG, "Requesting screen-capture permission")
        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        startActivityForResult(projectionManager.createScreenCaptureIntent(), REQUEST_MEDIA_PROJECTION)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == REQUEST_MEDIA_PROJECTION) {
            if (resultCode == RESULT_OK && data != null) {
                MonitoringService.screenshotResultCode = resultCode
                MonitoringService.screenshotData = data

                val autoCast = intent?.getBooleanExtra(EXTRA_AUTO_CAST, false) ?: false
                Log.d(TAG, "Screen-capture permission granted (autoCast=$autoCast)")

                val startIntent = Intent(this, MonitoringService::class.java)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    startForegroundService(startIntent)
                } else {
                    startService(startIntent)
                }
            } else {
                Log.w(TAG, "Screen-capture permission denied")
            }
        }
        finish()
    }
}
