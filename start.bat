@echo off
cd /d "%~dp0"
echo Starting Soul Clash server...
start "" http://localhost:8765
python dev_server.py
pause
