@echo off
cd /d "%~dp0"
start "ERA Trigram Sweep" cmd /k start-trigram-sweep.bat
timeout /t 2 /nobreak >nul
start "ERA Trigram Watch" cmd /k start-trigram-watch.bat
