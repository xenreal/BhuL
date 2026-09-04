@echo off
title BhuLekh Prototype Launcher
echo ========================================================
echo        BhuLekh - Land Record Digitization Engine        
echo ========================================================
echo.

set ROOT_DIR=%~dp0

echo [1/3] Starting Backend Server (FastAPI on Port 8000)...
start "BhuLekh Backend (FastAPI)" cmd /k "cd /d "%ROOT_DIR%Backend" && "%ROOT_DIR%Backend\myenv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Frontend Server (Vite React on Port 5173)...
start "BhuLekh Frontend (Vite)" cmd /k "cd /d "%ROOT_DIR%Frontend\bhulekh-frontend" && npm run dev"

echo [3/3] Opening BhuLekh Portal in your browser...
timeout /t 3 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================================
echo Both servers are running!
echo   - Backend API: http://127.0.0.1:8000
echo   - Frontend UI: http://localhost:5173
echo.
echo Leave the two open terminal windows running.
echo To stop everything, simply close those two command windows.
echo ========================================================
pause

