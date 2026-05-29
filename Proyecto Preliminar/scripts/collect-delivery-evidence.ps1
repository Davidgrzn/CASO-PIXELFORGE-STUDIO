param(
  [string]$OutputDir = "evidencias\defensa"
)

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

docker ps | Out-File "$OutputDir\docker-ps.txt"
docker compose ps | Out-File "$OutputDir\docker-compose-ps.txt"

try {
  Invoke-WebRequest -UseBasicParsing http://localhost/health | Out-File "$OutputDir\health-frontend.txt"
} catch {
  "Frontend health check failed: $($_.Exception.Message)" | Out-File "$OutputDir\health-frontend.txt"
}

try {
  Invoke-WebRequest -UseBasicParsing http://localhost/api/health | Out-File "$OutputDir\health-backend.txt"
} catch {
  "Backend health check failed: $($_.Exception.Message)" | Out-File "$OutputDir\health-backend.txt"
}

try {
  wg show | Out-File "evidencias\wireguard\wg-show.txt"
} catch {
  "WireGuard CLI not available or interface down: $($_.Exception.Message)" | Out-File "evidencias\wireguard\wg-show.txt"
}

ipconfig /all | Out-File "evidencias\wireguard\ipconfig.txt"
route print | Out-File "evidencias\wireguard\routes.txt"

Write-Host "Evidencia base guardada en $OutputDir"
