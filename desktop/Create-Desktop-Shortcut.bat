@echo off
setlocal
set "TARGET=%~dp0Aether.exe"
if not exist "%TARGET%" (
  echo Aether.exe was not found next to this script.
  pause
  exit /b 1
)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$desktop = [Environment]::GetFolderPath('Desktop');" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $desktop 'Aether.lnk'));" ^
  "$s.TargetPath = '%TARGET%';" ^
  "$s.WorkingDirectory = '%~dp0';" ^
  "$s.WindowStyle = 1;" ^
  "$s.Description = 'Aether Vertical Video Engine';" ^
  "$s.Save();" ^
  "Write-Host ('Shortcut created: ' + (Join-Path $desktop 'Aether.lnk'))"
echo.
echo Aether is on your desktop.
pause
