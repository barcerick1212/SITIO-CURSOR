@echo off
setlocal enabledelayedexpansion
set PORT=3001

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js no esta instalado. Abriendo pagina de descarga...
  start https://nodejs.org/
  echo Instala Node.js LTS y vuelve a ejecutar este archivo.
  pause
  exit /b 1
)

cd /d "%~dp0"

echo Instalando dependencias (npm install)...
npm install --no-audit --no-fund
if errorlevel 1 (
  echo [!] Error instalando dependencias
  pause
  exit /b 1
)

echo Iniciando API en http://localhost:%PORT%
set PORT=%PORT%
npm run start

endlocal
