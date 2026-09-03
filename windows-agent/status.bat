@echo off
cd /d "%~dp0"
echo Checking agent status...
python main.py --status
pause
