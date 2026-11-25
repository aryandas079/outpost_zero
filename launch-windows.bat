@echo off
title Outpost Zero - Standalone Windows Launcher (C++ / C# / WinUI 3)
cd /d "%~dp0"

set "WINUI_EXE=windows\OutpostZero.WinUI\bin\x64\Release\net10.0-windows10.0.22621.0\win-x64\OutpostZero.exe"

echo ========================================================
echo    OUTPOST ZERO - 10 km2 Battle Royale & Tactical FPS
echo    Native Windows Host (C++20 DXGI + C# WinUI 3)
echo ========================================================
echo.
echo [1] Launch Standalone Windows App (.exe)
echo [2] Launch in Browser (Vite Web Server)
echo [3] Launch WinUI 3 Native App in Live Development Mode
echo [4] Rebuild Full Native Windows App (Vite + C++ DLL + WinUI 3)
echo.
set /p CHOICE="Enter option [1-4] (default 1): "

if "%CHOICE%"=="" set CHOICE=1

if "%CHOICE%"=="1" (
    echo Launching Outpost Zero Standalone WinUI 3 App...
    if exist "%WINUI_EXE%" (
        start "" "%WINUI_EXE%"
    ) else (
        echo Native WinUI 3 executable not found! Building first...
        call npm.cmd run windows:build
        if exist "%WINUI_EXE%" start "" "%WINUI_EXE%"
    )
) else if "%CHOICE%"=="2" (
    echo Starting Outpost Zero Web Server...
    start http://localhost:3000
    call npm.cmd run dev
) else if "%CHOICE%"=="3" (
    echo Starting Outpost Zero WinUI 3 Host in Live Dev Mode...
    if not exist "%WINUI_EXE%" call npm.cmd run windows:build
    start cmd /c "npm.cmd run dev"
    timeout /t 3 >nul
    set "OUTPOST_DEV_URL=http://localhost:3000"
    start "" "%WINUI_EXE%"
) else if "%CHOICE%"=="4" (
    echo Building Outpost Zero Native Windows App (Vite + C++20 + C# WinUI 3)...
    call npm.cmd run windows:build
    echo.
    echo Done! Executable is at: %WINUI_EXE%
    pause
) else (
    echo Invalid option. Exiting.
)
