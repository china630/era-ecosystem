@echo off
title ERA Trigram Watch
cd /d "%~dp0"
chcp 65001 >nul
echo.
echo === ERA trigram sweep watcher ===
echo Updates every 60s. Log: data\legal-entities\.trigram-sweep-watch.log
echo.
node tools\trigram-sweep-watch.mjs
pause
