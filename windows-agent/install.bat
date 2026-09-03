@echo off
echo ============================================
echo  Employee Monitor Agent - Windows Installer
echo ============================================
echo.

cd /d "%~dp0"

echo [1/3] Checking Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Python is not installed or not in PATH.
    echo Download Python from: https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation.
    pause
    exit /b 1
)
echo Python found.

echo.
echo [2/3] Installing dependencies...
pip install -r requirements.txt
if %errorlevel% neq 0 (
    echo WARNING: Some dependencies failed to install.
)

echo.
echo [3/3] Configuring agent...
python main.py --install

echo.
echo ============================================
echo  Installation complete!
echo.
echo  To configure:
echo    python main.py --server http://your-server:3000
echo.
echo  To run:
echo    python main.py --run
echo.
echo  To run as Windows service:
echo    python main.py --service install
echo    python main.py --service start
echo ============================================
echo.
pause
