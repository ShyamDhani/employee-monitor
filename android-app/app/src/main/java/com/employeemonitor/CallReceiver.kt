package com.employeemonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

class CallReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "CallReceiver"
        private const val CALL_RECORD_DURATION = 60

        var isCallActive = false
            private set
    }

    override fun onReceive(context: Context?, intent: Intent?) {
        if (context == null || intent == null) return

        val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return
        val phoneNumber = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
            ?: intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)
            ?: "unknown"

        Log.d(TAG, "Phone state: $state, number: $phoneNumber")

        when (state) {
            TelephonyManager.EXTRA_STATE_RINGING -> {
                Log.d(TAG, "Incoming call from $phoneNumber")
                isCallActive = true
                startCallRecording(context, phoneNumber, "incoming")
            }
            TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                if (!isCallActive) {
                    Log.d(TAG, "Outgoing call to $phoneNumber")
                    isCallActive = true
                    startCallRecording(context, phoneNumber, "outgoing")
                }
            }
            TelephonyManager.EXTRA_STATE_IDLE -> {
                Log.d(TAG, "Call ended")
                isCallActive = false
                notifyCallEnded(context, phoneNumber)
            }
        }
    }

    private fun startCallRecording(context: Context, phoneNumber: String, callType: String) {
        val serverUrl = DeviceConfig.getServerUrl(context)
        val employeeId = DeviceConfig.getEmployeeId(context)
        if (serverUrl.isEmpty() || employeeId.isEmpty()) {
            Log.w(TAG, "Not configured, skipping call recording")
            return
        }

        Log.d(TAG, "Auto-starting recording for $callType call from $phoneNumber")

        val intent = Intent(context, MonitoringService::class.java).apply {
            putExtra("command", "record_audio")
            putExtra("duration", CALL_RECORD_DURATION)
            putExtra("event_type", "call_$callType")
            putExtra("phone_number", phoneNumber)
        }

        try {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to start service for call recording", e)
        }
    }

    private fun notifyCallEnded(context: Context, phoneNumber: String) {
        val serverUrl = DeviceConfig.getServerUrl(context)
        val employeeId = DeviceConfig.getEmployeeId(context)
        if (serverUrl.isEmpty() || employeeId.isEmpty()) return

        try {
            val json = JSONObject().apply {
                put("employee_id", employeeId)
                put("app_package", "phone_call")
                put("app_name", "Phone Call Ended")
                put("timestamp", System.currentTimeMillis())
            }

            val body = json.toString().toRequestBody("application/json".toMediaType())
            val client = OkHttpClient.Builder()
                .connectTimeout(10, TimeUnit.SECONDS)
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/activity/upload")
                .post(body)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    Log.e(TAG, "Failed to notify call ended: ${e.message}")
                }
                override fun onResponse(call: Call, response: okhttp3.Response) {
                    Log.d(TAG, "Call ended notification sent: ${response.code}")
                    response.close()
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Error notifying call ended", e)
        }
    }
}
