@echo off
cd /d "%~dp0"
if not exist node_modules (
  echo Development dependencies are missing. Run npm.cmd ci first.
  pause
  exit /b 1
)
if not exist dist\index.html (
  call npm.cmd run build
  if errorlevel 1 exit /b 1
)
call npm.cmd run desktop
