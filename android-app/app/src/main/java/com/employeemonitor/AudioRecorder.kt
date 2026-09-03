package com.employeemonitor

import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import android.util.Base64
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.RequestBody.Companion.asRequestBody
import java.io.ByteArrayOutputStream
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.TimeUnit

class AudioRecorder(private val serverUrl: String, private val employeeId: String) {

    companion object {
        private const val TAG = "AudioRecorder"
        private const val SAMPLE_RATE = 16000
        private const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        private const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    private var audioRecord: AudioRecord? = null
    private var isRecording = false
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .header("bypass-tunnel-reminder", "true")
                .build()
            chain.proceed(request)
        }
        .build()

    fun startRecording(durationSeconds: Int, callback: (Boolean, String) -> Unit) {
        if (isRecording) {
            callback(false, "Already recording")
            return
        }

        try {
            val bufferSize = AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT)
            audioRecord = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                SAMPLE_RATE,
                CHANNEL_CONFIG,
                AUDIO_FORMAT,
                bufferSize * 2
            )

            if (audioRecord?.state != AudioRecord.STATE_INITIALIZED) {
                callback(false, "Failed to initialize AudioRecord")
                return
            }

            isRecording = true
            audioRecord?.startRecording()

            Thread {
                try {
                    val pcmStream = ByteArrayOutputStream()
                    val buffer = ShortArray(bufferSize)
                    val totalSamples = SAMPLE_RATE * durationSeconds
                    var samplesRead = 0

                    while (isRecording && samplesRead < totalSamples) {
                        val read = audioRecord?.read(buffer, 0, buffer.size) ?: 0
                        if (read > 0) {
                            for (i in 0 until read) {
                                pcmStream.write(buffer[i].toInt() and 0xFF)
                                pcmStream.write((buffer[i].toInt() shr 8) and 0xFF)
                            }
                            samplesRead += read
                        }
                    }

                    isRecording = false
                    audioRecord?.stop()
                    audioRecord?.release()
                    audioRecord = null

                    val pcmBytes = pcmStream.toByteArray()
                    val wavBytes = pcmToWav(pcmBytes, SAMPLE_RATE, 1, 16)
                    Log.d(TAG, "Recording complete: ${wavBytes.size} bytes WAV")

                    sendAudioMultipart(wavBytes, callback)
                } catch (e: Exception) {
                    isRecording = false
                    Log.e(TAG, "Recording error", e)
                    callback(false, "Recording error: ${e.message}")
                }
            }.start()

            callback(true, "Recording started for ${durationSeconds}s")
        } catch (e: SecurityException) {
            Log.e(TAG, "Audio permission not granted", e)
            callback(false, "Audio permission not granted")
        } catch (e: Exception) {
            Log.e(TAG, "Start recording error", e)
            callback(false, "Error: ${e.message}")
        }
    }

    fun stopRecording() {
        isRecording = false
        try {
            audioRecord?.stop()
            audioRecord?.release()
            audioRecord = null
        } catch (e: Exception) {
            Log.e(TAG, "Error stopping recording", e)
        }
    }

    private fun pcmToWav(pcmData: ByteArray, sampleRate: Int, channels: Int, bitsPerSample: Int): ByteArray {
        val outputStream = ByteArrayOutputStream()
        val byteRate = sampleRate * channels * bitsPerSample / 8
        val blockAlign = channels * bitsPerSample / 8
        val dataSize = pcmData.size
        val totalSize = 44 + dataSize

        outputStream.write("RIFF".toByteArray())
        outputStream.write(intToLittleEndian(totalSize - 8))
        outputStream.write("WAVE".toByteArray())
        outputStream.write("fmt ".toByteArray())
        outputStream.write(intToLittleEndian(16))
        outputStream.write(shortToLittleEndian(1))
        outputStream.write(shortToLittleEndian(channels))
        outputStream.write(intToLittleEndian(sampleRate))
        outputStream.write(intToLittleEndian(byteRate))
        outputStream.write(shortToLittleEndian(blockAlign))
        outputStream.write(shortToLittleEndian(bitsPerSample))
        outputStream.write("data".toByteArray())
        outputStream.write(intToLittleEndian(dataSize))
        outputStream.write(pcmData)

        return outputStream.toByteArray()
    }

    private fun intToLittleEndian(value: Int): ByteArray {
        return byteArrayOf(
            (value and 0xFF).toByte(),
            ((value shr 8) and 0xFF).toByte(),
            ((value shr 16) and 0xFF).toByte(),
            ((value shr 24) and 0xFF).toByte()
        )
    }

    private fun shortToLittleEndian(value: Int): ByteArray {
        return byteArrayOf(
            (value and 0xFF).toByte(),
            ((value shr 8) and 0xFF).toByte()
        )
    }

    private fun sendAudioMultipart(wavBytes: ByteArray, callback: (Boolean, String) -> Unit) {
        if (serverUrl.isEmpty() || employeeId.isEmpty()) {
            callback(false, "Not configured")
            return
        }

        val durationMs = wavBytes.size * 1000L / (SAMPLE_RATE * 2)
        Log.d(TAG, "Uploading WAV: ${wavBytes.size / 1024}KB, ${durationMs}ms to $serverUrl/api/audio/upload")

        try {
            val tempFile = File.createTempFile("audio_", ".wav")
            tempFile.deleteOnExit()
            FileOutputStream(tempFile).use { it.write(wavBytes) }

            val body = MultipartBody.Builder()
                .setType(MultipartBody.FORM)
                .addFormDataPart("employee_id", employeeId)
                .addFormDataPart("timestamp", System.currentTimeMillis().toString())
                .addFormDataPart("sample_rate", SAMPLE_RATE.toString())
                .addFormDataPart("duration_ms", durationMs.toString())
                .addFormDataPart(
                    "audio",
                    "recording.wav",
                    tempFile.asRequestBody("audio/wav".toMediaType())
                )
                .build()

            val request = Request.Builder()
                .url("$serverUrl/api/audio/upload")
                .post(body)
                .build()

            client.newCall(request).enqueue(object : Callback {
                override fun onFailure(call: Call, e: java.io.IOException) {
                    Log.e(TAG, "Upload FAILED: ${e.message}", e)
                    callback(false, "Upload failed: ${e.message}")
                }

                override fun onResponse(call: Call, response: Response) {
                    val respBody = response.body?.string()
                    Log.d(TAG, "Upload response: ${response.code} - $respBody")
                    callback(
                        response.isSuccessful,
                        if (response.isSuccessful) "Audio uploaded successfully"
                        else "Upload error ${response.code}: $respBody"
                    )
                    response.close()
                    try { tempFile.delete() } catch (_: Exception) {}
                }
            })
        } catch (e: Exception) {
            Log.e(TAG, "Upload error", e)
            callback(false, "Upload error: ${e.message}")
        }
    }
}
