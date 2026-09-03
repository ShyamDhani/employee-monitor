package com.employeemonitor

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import android.widget.Toast

class EmployeeAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "DeviceAdmin"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.d(TAG, "Device Admin enabled - uninstall protection active")
        Toast.makeText(context, "Device Admin activated. Uninstall protection enabled.", Toast.LENGTH_SHORT).show()
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.d(TAG, "Device Admin disabled")
        Toast.makeText(context, "Device Admin deactivated.", Toast.LENGTH_SHORT).show()
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence {
        return "Disabling Device Admin will allow the Employee Monitor app to be uninstalled. Are you sure?"
    }
}
