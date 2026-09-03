package com.employeemonitor

import android.content.Context
import android.net.ConnectivityManager
import android.net.Network
import android.net.NetworkCapabilities
import android.net.NetworkRequest
import android.util.Log
import androidx.lifecycle.LiveData
import androidx.lifecycle.MutableLiveData

class ConnectivityMonitor(private val context: Context) {

    companion object {
        private const val TAG = "ConnectivityMonitor"

        @Volatile
        private var INSTANCE: ConnectivityMonitor? = null

        fun getInstance(context: Context): ConnectivityMonitor {
            return INSTANCE ?: synchronized(this) {
                val instance = ConnectivityMonitor(context.applicationContext)
                INSTANCE = instance
                instance
            }
        }
    }

    private val connectivityManager =
        context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager

    private val _isNetworkAvailable = MutableLiveData<Boolean>()
    val isNetworkAvailable: LiveData<Boolean> = _isNetworkAvailable

    private var callback: ConnectivityManager.NetworkCallback? = null

    fun startMonitoring() {
        if (callback != null) return

        val networkRequest = NetworkRequest.Builder()
            .addCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
            .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
            .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
            .addTransportType(NetworkCapabilities.TRANSPORT_ETHERNET)
            .build()

        callback = object : ConnectivityManager.NetworkCallback() {
            override fun onAvailable(network: Network) {
                Log.d(TAG, "Network available")
                _isNetworkAvailable.postValue(true)
            }

            override fun onLost(network: Network) {
                Log.d(TAG, "Network lost")
                _isNetworkAvailable.postValue(false)
            }

            override fun onCapabilitiesChanged(
                network: Network,
                networkCapabilities: NetworkCapabilities
            ) {
                val hasInternet = networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_INTERNET
                ) && networkCapabilities.hasCapability(
                    NetworkCapabilities.NET_CAPABILITY_VALIDATED
                )
                _isNetworkAvailable.postValue(hasInternet)
            }
        }

        try {
            connectivityManager.registerNetworkCallback(networkRequest, callback!!)
            _isNetworkAvailable.postValue(isCurrentlyConnected())
            Log.d(TAG, "Network monitoring started")
        } catch (e: Exception) {
            Log.e(TAG, "Failed to register network callback", e)
        }
    }

    fun stopMonitoring() {
        callback?.let {
            try {
                connectivityManager.unregisterNetworkCallback(it)
            } catch (e: Exception) {
                Log.e(TAG, "Failed to unregister network callback", e)
            }
        }
        callback = null
        Log.d(TAG, "Network monitoring stopped")
    }

    fun isCurrentlyConnected(): Boolean {
        val network = connectivityManager.activeNetwork ?: return false
        val capabilities = connectivityManager.getNetworkCapabilities(network) ?: return false
        return capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) &&
                capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)
    }
}
