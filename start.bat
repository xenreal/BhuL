@echo off
title Bhu Khata Prototype Launcher
echo ========================================================
echo        Bhu Khata - Land Record Digitization Engine        
echo ========================================================
echo.

set ROOT_DIR=%~dp0

echo [1/4] Checking Ollama AI Service...
netstat -ano | findstr 11434 >nul
if not errorlevel 1 (
    echo       [OK] Ollama is already running on port 11434.
) else (
    echo       [..] Ollama not detected. Starting Ollama in the background...
    if exist "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" (
        start "Ollama AI Server" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe" serve
    ) else (
        start "Ollama AI Server" ollama serve
    )
    ping 127.0.0.1 -n 4 >nul
)

echo [2/4] Starting Backend Server (FastAPI on Port 8000)...
start "Bhu Khata Backend (FastAPI)" cmd /k "cd /d "%ROOT_DIR%Backend" && "%ROOT_DIR%Backend\myenv\Scripts\python.exe" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload"

echo [3/4] Starting Frontend Server (Vite React on Port 5173)...
start "Bhu Khata Frontend (Vite)" cmd /k "cd /d "%ROOT_DIR%Frontend\bhulekh-frontend" && npm run dev"

echo [4/4] Opening Bhu Khata Portal in your browser...
ping 127.0.0.1 -n 4 >nul
start http://localhost:5173

echo.
echo ========================================================
echo All Bhu Khata services are running!
echo   - Ollama AI Server : http://127.0.0.1:11434
echo   - Backend API      : http://127.0.0.1:8000
echo   - Frontend UI      : http://localhost:5173
echo.
echo Leave the open terminal windows running.
echo To stop everything, simply close those command windows.
echo ========================================================
pause

