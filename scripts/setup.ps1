# Q-CFA — installation locale complète (Windows PowerShell)
# Équivalent : npm run setup
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js / npm introuvable. Installe Node 20+ depuis https://nodejs.org puis relance ce script."
  exit 1
}

npm run setup
