@echo off
setlocal
cd /d "%~dp0"

set "VCVARS=D:\Visual Studio\VC\Auxiliary\Build\vcvars64.bat"
if not exist "%VCVARS%" (
  echo [ERROR] vcvars64.bat not found at "%VCVARS%"
  exit /b 1
)
call "%VCVARS%" >nul

if not exist "bin\x64\Release" mkdir "bin\x64\Release"

cl /nologo /std:c++20 /O2 /EHsc /W4 /DUNICODE /D_UNICODE /LD OutpostNative.cpp ^
  /Fe:"bin\x64\Release\OutpostZero.Native.dll" ^
  /Fo:"bin\x64\Release\OutpostNative.obj" ^
  /link /IMPLIB:"bin\x64\Release\OutpostZero.Native.lib" dxgi.lib winmm.lib avrt.lib user32.lib
if errorlevel 1 exit /b 1

cl /nologo /std:c++20 /O2 /EHsc /W4 /DUNICODE /D_UNICODE OutpostNative.Tests.cpp ^
  "bin\x64\Release\OutpostZero.Native.lib" ^
  /Fe:"bin\x64\Release\OutpostZero.Native.Tests.exe" ^
  /Fo:"bin\x64\Release\OutpostNative.Tests.obj"
if errorlevel 1 exit /b 1

echo [OutpostZero.Native] Built Release x64 DLL and Tests successfully.
