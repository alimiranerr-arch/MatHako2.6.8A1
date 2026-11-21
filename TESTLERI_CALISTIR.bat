@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tests\smoke.test.js
if errorlevel 1 (
  echo.
  echo TESTLERDE HATA VAR.
) else (
  echo.
  echo TÜM OTOMATİK TESTLER BAŞARILI.
)
pause
