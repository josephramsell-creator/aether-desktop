@echo off
setlocal EnableExtensions
title Aether 2.0 update patch
echo.
echo  Close Aether before patching.
echo.

set "HERE=%~dp0"
if "%HERE:~-1%"=="\" set "HERE=%HERE:~0,-1%"

set "PAYLOAD=%HERE%\payload"
if not exist "%PAYLOAD%\resources\app.asar" (
  echo  This patch is missing payload\resources\app.asar
  echo  Unzip the whole archive first, then run APPLY-v2.bat
  pause
  exit /b 1
)

set "TARGET="
if exist "%HERE%\Aether.exe" set "TARGET=%HERE%"
if not defined TARGET if exist "%HERE%\..\Aether.exe" (
  for %%I in ("%HERE%\..") do set "TARGET=%%~fI"
)

if not defined TARGET (
  echo  Could not find Aether.exe next to this patch.
  echo  Paste the full path of your Aether folder
  echo  ^(the folder that contains Aether.exe^) and press Enter.
  set /p "TARGET=Aether folder: "
)

if not exist "%TARGET%\Aether.exe" (
  echo.
  echo  Could not find Aether.exe in:
  echo    %TARGET%
  echo.
  echo  Unzip this patch, then run APPLY-v2.bat from inside
  echo  your existing Aether folder, or paste that folder path.
  pause
  exit /b 1
)

echo  Patching:
echo    %TARGET%
echo.
mkdir "%TARGET%\resources" >nul 2>&1
mkdir "%TARGET%\data\content" >nul 2>&1

copy /Y "%PAYLOAD%\resources\app.asar" "%TARGET%\resources\app.asar" >nul
if errorlevel 1 (
  echo  Failed to copy app.asar — is Aether still open?
  pause
  exit /b 1
)

if not exist "%TARGET%\data\content\aether-production.xlsx" (
  copy /Y "%PAYLOAD%\data\content\aether-production.xlsx" "%TARGET%\data\content\aether-production.xlsx" >nul
)
copy /Y "%PAYLOAD%\data\content\aether-production.template.xlsx" "%TARGET%\data\content\aether-production.template.xlsx" >nul
if exist "%PAYLOAD%\data\content\aether-production.json" copy /Y "%PAYLOAD%\data\content\aether-production.json" "%TARGET%\data\content\aether-production.json" >nul
copy /Y "%HERE%\UPDATE-v2.txt" "%TARGET%\UPDATE-v2.txt" >nul

echo  Aether 2.0.0 is installed.
echo  Your old readings workbook was left alone if it already existed.
echo  Start Aether.exe when ready.
echo.
pause
