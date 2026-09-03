@echo off
echo ==========================================
echo   Employee Monitor - Starting Services
echo ==========================================
echo.

:: Step 1: Check Node.js
where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Node.js is not installed.
    echo Download from: https://nodejs.org/
    pause
    exit /b 1
)

:: Step 2: Check MongoDB
echo [1/5] Checking MongoDB...
mongod --version >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [WARNING] MongoDB not found in PATH.
    echo Make sure MongoDB is running on port 27017.
    echo Download: https://www.mongodb.com/try/download/community
    echo.
)

:: Step 3: Install backend dependencies
echo [2/5] Installing backend dependencies...
cd backend
if not exist node_modules (
    call npm install
)
cd ..

:: Step 4: Start backend
echo [3/5] Starting backend server on port 3000...
start "EmployeeMonitor-Backend" cmd /c "cd backend && node server.js"
timeout /t 3 /nobreak >nul

:: Step 5: Start dashboard
echo [4/5] Starting dashboard on port 5173...
start "EmployeeMonitor-Dashboard" cmd /c "cd web-dashboard && npx vite --host"
timeout /t 3 /nobreak >nul

echo.
echo ==========================================
echo   SERVICES STARTED
echo ==========================================
echo   Backend API:  http://localhost:3000
echo   Dashboard:    http://localhost:5173
echo ==========================================
echo.

:: Step 6: ngrok setup
echo [5/5] Setting up ngrok tunnel...
echo.

:: Check if ngrok is installed
where ngrok >nul 2>nul
if %ERRORLEVEL% neq 0 (
    if exist "ngrok.exe" (
        set "NGROK_CMD=ngrok.exe"
    ) else (
        echo ngrok is not installed or blocked by Windows Defender.
        echo.
        echo OPTION A: Install ngrok manually
        echo   1. Download from: https://ngrok.com/download
        echo   2. Extract ngrok.exe to this folder
        echo   3. Run: ngrok config add-authtoken YOUR_TOKEN
        echo   4. Run: ngrok http 5173 --domain=YOUR_DOMAIN
        echo.
        echo OPTION B: Use Cloudflare Tunnel (recommended, not blocked by Defender)
        echo   1. Download from: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
        echo   2. Run: cloudflared tunnel --url http://localhost:5173
        echo.
        echo OPTION C: Manual ngrok from another terminal
        echo   Open another terminal and run:
        echo   ngrok http 5173 --domain=employee-monitor.ngrok-free.app
        echo.
        goto :end
    )
) else (
    set "NGROK_CMD=ngrok"
)

echo Starting ngrok tunnel...
echo ==========================================
echo   PUBLIC DASHBOARD: https://employee-monitor.ngrok-free.app
echo   PUBLIC API:       https://employee-monitor.ngrok-free.app/api/health
echo   ngrok Inspector:  http://localhost:4040
echo ==========================================
echo.
echo Android app should use:
echo   val SERVER_URL = "https://employee-monitor.ngrok-free.app"
echo.
echo Press Ctrl+C to stop all services.
echo.

start "ngrok" %NGROK_CMD% http 5173 --domain=employee-monitor.ngrok-free.app

:end
echo.
echo Press any key to stop all services...
pause >nul

:: Cleanup
taskkill /FI "WINDOWTITLE eq EmployeeMonitor-Backend*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq EmployeeMonitor-Dashboard*" /F >nul 2>nul
taskkill /FI "WINDOWTITLE eq ngrok*" /F >nul 2>nul
echo All services stopped.
