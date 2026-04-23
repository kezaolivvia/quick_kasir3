@echo off
echo ========================================
echo   Quick Kasir - Local Server
echo ========================================
echo.
echo Aplikasi berjalan di:
echo   PC    : http://localhost:8080
echo   HP    : http://192.168.2.88:8080
echo.
echo Pastikan HP terhubung ke WiFi yang sama!
echo Tekan Ctrl+C untuk stop server.
echo ========================================
echo.
cd /d "%~dp0"
python -m http.server 8080
pause
