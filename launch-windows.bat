@echo off
title Outpost Zero - Windows Launcher
cd /d "%~dp0"

echo ========================================================
echo    OUTPOST ZERO - 3D Tactical Combat Simulator
echo ========================================================
echo.
echo [1] Launch Standalone Native Windows App (.exe)
echo [2] Launch in Browser (Vite Web Server)
echo [3] Launch Electron Desktop in Live Development Mode
echo [4] Re-package Standalone Windows Executable (.exe)
echo.
set /p CHOICE="Enter option [1-4] (default 1): "

if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    echo Launching Outpost Zero Standalone App...
    if exist "release\win-unpacked\Outpost Zero.exe" (
        start "" "release\win-unpacked\Outpost Zero.exe"
    ) else (
        echo Standalone executable not found! Building first...
        call npm.cmd run electron:pack
        start "" "release\win-unpacked\Outpost Zero.exe"
    )
) else if "%CHOICE%"=="2" (
    echo Starting Outpost Zero Web Server...
    start http://localhost:3000
    call npm.cmd run dev
) else if "%CHOICE%"=="3" (
    echo Starting Outpost Zero in Live Electron Dev Mode...
    start cmd /c "npm.cmd run dev"
    timeout /t 3 >nul
    call npm.cmd run electron:dev
) else if "%CHOICE%"=="4" (
    echo Building Standalone Windows Executable...
    call npm.cmd run electron:pack
    echo.
    echo Done! Executable is at: release\win-unpacked\Outpost Zero.exe
    pause
) else (
    echo Invalid option. Exiting.
)
