@echo off
REM ──────────────────────────────────────────────────────────
REM  RemoteLink Launch Script for Windows
REM ──────────────────────────────────────────────────────────
echo.
echo  ╔══════════════════════════════════════════╗
echo  ║         RemoteLink for Windows           ║
echo  ╚══════════════════════════════════════════╝
echo.

REM Check Python
python --version >nul 2>&1
if errorlevel 1 (
  echo  ERROR: Python not found.
  echo  Please install from https://python.org
  pause
  exit /b 1
)

REM Install dependencies if needed
echo  Installing dependencies...
python -m pip install pillow --quiet --exists-action i
python -m pip install pywin32 --quiet --exists-action i

echo  Starting RemoteLink...
echo.
python remotelink.py
pause
