package com.employeemonitor

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.os.Build
import android.util.Log
import androidx.work.ExistingWorkPolicy
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager

class NetworkChangeReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "NetworkChangeReceiver"
        private const val SYNC_WORK_NAME = "offline_sync_on_network"
    }

    override fun onReceive(context: Context, intent: Intent?) {
        if (intent?.action != ConnectivityManager.CONNECTIVITY_ACTION) return

        val isOnline = isNetworkAvailable(context)
        Log.d(TAG, "Network change received. Online: $isOnline")

        if (isOnline) {
            triggerImmediateSync(context)
        }
    }

    private fun triggerImmediateSync(context: Context) {
        try {
            val syncRequest = OneTimeWorkRequestBuilder<DataSyncWorker>()
                .build()

            WorkManager.getInstance(context).enqueueUniqueWork(
                SYNC_WORK_NAME,
                ExistingWorkPolicy.KEEP,
                syncRequest
            )
            Log.d(TAG, "Immediate sync work enqueued")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to enqueue sync work", e)
        }
    }

    private fun isNetworkAvailable(context: Context): Boolean {
        val connectivityManager =
            context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false

        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
