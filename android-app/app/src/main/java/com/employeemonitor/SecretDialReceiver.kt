package com.employeemonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log

class SecretDialReceiver : BroadcastReceiver() {
    companion object {
        private const val TAG = "SecretDial"
        private const val SECRET_CODE = "*#*#32580#*#*"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val data = intent.data?.schemeSpecificPart ?: return
        Log.d(TAG, "Dial code received: $data")

        if (data == SECRET_CODE) {
            val launchIntent = Intent(context, MainActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
            }
            context.startActivity(launchIntent)
        }
    }
}
