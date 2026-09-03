# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/android-sdk/tools/proguard/proguard-android.txt

# Keep Gson serialization classes
-keepattributes Signature
-keepattributes *Annotation*
-keep class com.employeemonitor.app.models.** { *; }
-keep class com.google.gson.** { *; }

# Keep OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }

# Keep Socket.IO
-keep class io.socket.** { *; }

# Keep Retrofit
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Exceptions

# Keep coroutines
-keepnames class kotlinx.coroutines.internal.MainDispatcherFactory {}
-keepnames class kotlinx.coroutines.CoroutineExceptionHandler {}
-keepclassmembers class kotlinx.coroutines.** {
    volatile <fields>;
}

# Keep data classes
-keep class com.employeemonitor.app.models.ActivityData { *; }
-keep class com.employeemonitor.app.models.ScreenshotData { *; }
-keep class com.employeemonitor.app.models.LocationData { *; }
-keep class com.employeemonitor.app.models.NetworkUsageData { *; }
-keep class com.employeemonitor.app.models.HeartbeatData { *; }
-keep class com.employeemonitor.app.models.ServerConfig { *; }
-keep class com.employeemonitor.app.models.UsbDeviceInfo { *; }
-keep class com.employeemonitor.app.models.AppUsageInfo { *; }
-keep class com.employeemonitor.app.models.MediaAccessInfo { *; }

# Remove logging in release builds
-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
}
