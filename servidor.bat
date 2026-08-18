@echo off
rem Los modulos ES no cargan desde file:// -- hace falta un servidor.
cd /d "%~dp0"
echo.
echo   drible  ->  http://localhost:8000
echo   En el celular, misma wifi:
ipconfig ^| findstr /c:"IPv4"
echo.
python -m http.server 8000
