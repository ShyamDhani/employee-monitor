@echo off
cd /d "%~dp0"
echo Starting Employee Monitor Agent...
python main.py --run
pause
