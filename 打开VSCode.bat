@echo off
rem Launch VS Code with the blog project (double-click me)
cd /d "C:\Users\admin\WorkBuddy\2026-09-30-13-04-31\blog-system"
start "" "%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe" "C:\Users\admin\WorkBuddy\2026-09-30-13-04-31\blog-system"
if errorlevel 1 (
  echo.
  echo [ERROR] VS Code failed to launch. errorlevel=%errorlevel%
  pause
) else (
  echo VS Code launched. This window can close now.
  timeout /t 2 >nul
)
