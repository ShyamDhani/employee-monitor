package com.employeemonitor

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.provider.Settings
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

object DeviceConfig {

    private const val PREFS_NAME = "monitor_config"
    private const val KEY_SERVER_URL = "server_url"
    private const val KEY_EMPLOYEE_ID = "employee_id"
    private const val KEY_IS_CONFIGURED = "is_configured"
    private const val DEFAULT_SERVER_URL = "http://127.0.0.1:3000"

    private val client = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .addInterceptor { chain ->
            val request = chain.request().newBuilder()
                .header("ngrok-skip-browser-warning", "true")
                .header("bypass-tunnel-reminder", "true")
                .build()
            chain.proceed(request)
        }
        .build()

    fun getServerUrl(context: Context): String {
        val stored = getPrefs(context).getString(KEY_SERVER_URL, null)
        return if (!stored.isNullOrBlank()) stored else DEFAULT_SERVER_URL
    }

    fun setServerUrl(context: Context, url: String) {
        getPrefs(context).edit()
            .putString(KEY_SERVER_URL, url.trimEnd('/'))
            .apply()
    }

    fun getEmployeeId(context: Context): String {
        return getPrefs(context).getString(KEY_EMPLOYEE_ID, "") ?: ""
    }

    fun isConfigured(context: Context): Boolean {
        return getPrefs(context).getBoolean(KEY_IS_CONFIGURED, false)
    }

    fun getDeviceId(context: Context): String {
        return Settings.Secure.getString(context.contentResolver, Settings.Secure.ANDROID_ID)
    }

    fun configureDevice(context: Context, callback: (Boolean, String) -> Unit) {
        val deviceId = getDeviceId(context)
        val url = "${getServerUrl(context)}/api/employees/device/$deviceId/config"

        val request = Request.Builder()
            .url(url)
            .get()
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                callback(false, "Connection failed: ${e.message}")
            }

            override fun onResponse(call: Call, response: Response) {
                val body = response.body?.string()
                if (response.isSuccessful && body != null) {
                    try {
                        val json = JSONObject(body)
                        if (json.getBoolean("success")) {
                            val empId = json.getString("employee_id")
                            val name = json.getString("name")

                            getPrefs(context).edit()
                                .putString(KEY_EMPLOYEE_ID, empId)
                                .putBoolean(KEY_IS_CONFIGURED, true)
                                .apply()

                            callback(true, "Configured: $name ($empId)")
                        } else {
                            callback(false, "Server error: ${json.optString("message", "Unknown")}")
                        }
                    } catch (e: Exception) {
                        callback(false, "Parse error: ${e.message}")
                    }
                } else {
                    callback(false, "HTTP ${response.code}: ${response.message}")
                }
            }
        })
    }

    fun isNetworkAvailable(context: Context): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false

        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }

    fun reset(context: Context) {
        getPrefs(context).edit().clear().apply()
    }

    private fun getPrefs(context: Context) = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
}
