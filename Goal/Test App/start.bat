@echo off
REM One-click launcher: build & run with Docker Compose, then open browser
docker compose up --build -d
REM small pause to let server start
timeout /t 2 /nobreak >nul
start http://localhost:3000
