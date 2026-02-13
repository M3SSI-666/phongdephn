@echo off
title Phong Dep HN - Dev Server
echo.
echo ========================================
echo    PHONG DEP HN - Khoi dong du an
echo ========================================
echo.

set PATH=C:\Users\PC\AppData\Local\nodejs;%PATH%
cd /d C:\Users\PC\OneDrive\Desktop\PhongdepHN

echo Dang khoi dong...
echo.
echo  Website khach:  http://localhost:5173
echo  Admin Tool:     http://localhost:5173/admin
echo.
echo  Nhan Ctrl+C de dung.
echo ========================================
echo.

npm run dev
pause
