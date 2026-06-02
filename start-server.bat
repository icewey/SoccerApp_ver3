@echo off
python launch.py
if %errorlevel% neq 0 (
    echo.
    echo [Error] Python not found. Install from https://www.python.org/downloads/
    pause
)
