# Requires: PowerShell 5+
# Uso: doble clic o clic derecho > Run with PowerShell

param(
  [int]$Port = 3001
)

Write-Host "== TechMarket Backend Starter ==" -ForegroundColor Cyan

# 1) Verificar Node.js/npm
$node = Get-Command node -ErrorAction SilentlyContinue
$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
  Write-Warning "Node.js/npm no están instalados. Abriendo la página de descarga..."
  Start-Process "https://nodejs.org/" | Out-Null
  Write-Host "Instala la versión LTS de Node.js y vuelve a ejecutar este script." -ForegroundColor Yellow
  exit 1
}

# 2) Ir al directorio del backend (este script vive aquí)
Set-Location -Path $PSScriptRoot

# 3) Instalar dependencias (solo la primera vez o cuando cambien)
Write-Host "Instalando dependencias (npm install)..." -ForegroundColor Cyan
npm install --no-audit --no-fund
if ($LASTEXITCODE -ne 0) {
  Write-Error "Fallo al instalar dependencias. Revisa el log anterior."
  exit 1
}

# 4) Iniciar el servidor en el puerto indicado
Write-Host "Iniciando API en http://localhost:$Port ..." -ForegroundColor Green
$env:PORT = "$Port"
npm run start


