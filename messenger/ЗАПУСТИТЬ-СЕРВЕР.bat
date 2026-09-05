@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================
echo   Запуск сервера мессенджера...
echo ========================================
echo.
echo   Сайт чата:  http://localhost:5000
echo.
echo   Чтобы ОСТАНОВИТЬ сервер - просто
echo   закрой это чёрное окно.
echo ========================================
echo.
".\venv\Scripts\python.exe" "server\server.py"
pause
