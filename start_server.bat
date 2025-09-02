@echo off
setlocal

REM --- Set your project folder
set PROJ="D:\Users\Roboteam Engineering\Mistral Projects\WM Plant Management\Project Tracker"

cd /d %PROJ%

REM --- Kill anything already listening on port 5000
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :5000 ^| findstr LISTENING') do (
  echo Killing PID %%a on port 5000...
  taskkill /PID %%a /F >nul 2>nul
)

REM --- Start Flask server in a named window (so it doesn't double-open)
start "TrackerServer" cmd /k "python server.py"

REM --- Give it a moment to boot
timeout /t 3 /nobreak >nul

REM --- Open in browser
start http://192.168.30.123:5000

endlocal
