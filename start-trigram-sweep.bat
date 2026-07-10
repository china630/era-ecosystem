@echo off
title ERA Trigram Sweep (resume)
cd /d "%~dp0"
chcp 65001 >nul
echo.
echo === Resume trigram sweep (auto-clears stale lock) ===
node tools\enrich-etaxes-trigram-sweep.mjs --rebuild
echo.
pause
