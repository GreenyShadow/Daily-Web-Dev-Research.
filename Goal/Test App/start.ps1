# One-click PowerShell launcher: build & run with Docker Compose, then open browser
try {
  docker compose up --build -d | Out-Null
} catch {
  Write-Host "Failed to run docker compose. Ensure Docker is installed and in PATH." -ForegroundColor Red
  exit 1
}
Start-Sleep -Seconds 2
Start-Process "http://localhost:3000"
