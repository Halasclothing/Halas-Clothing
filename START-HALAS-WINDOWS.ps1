$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host ''
Write-Host 'HALA.S — local development launcher' -ForegroundColor Magenta
Write-Host "Project: $ProjectRoot" -ForegroundColor DarkGray

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
  throw 'Node.js is not installed. Install Node.js 22 LTS or newer, then reopen PowerShell.'
}
$nodeVersion = (& node -p "process.versions.node").Trim()
$major = [int]($nodeVersion.Split('.')[0])
if ($major -lt 22) {
  throw "Node.js 22 or newer is required for the included test suite. Detected: $nodeVersion"
}

if (-not (Test-Path '.env.local')) {
  Copy-Item '.env.example' '.env.local'
  Write-Host 'Created .env.local from .env.example.' -ForegroundColor Yellow
  Write-Host 'Add your existing Supabase Project URL and anon/publishable key to .env.local.' -ForegroundColor Yellow
  Write-Host 'Do not add a service-role key to any VITE_ variable.' -ForegroundColor Yellow
  notepad.exe (Join-Path $ProjectRoot '.env.local')
  Read-Host 'Save .env.local, close Notepad, then press Enter to continue'
}

# A folder named node_modules can exist after an interrupted install. Check the
# actual Vite and database-test packages before deciding dependencies are ready.
$dependenciesReady = (Test-Path 'node_modules/.bin/vite.cmd') -and
                     (Test-Path 'node_modules/embedded-postgres/package.json') -and
                     (Test-Path 'node_modules/@supabase/supabase-js/package.json')
if (-not $dependenciesReady) {
  Write-Host 'Installing/verifying locked dependencies (first run may take a few minutes)...' -ForegroundColor Cyan
  npm ci --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check your internet connection, then run npm ci again.' }
}

# Fail early with a useful message instead of opening a broken dev server.
if (-not (Test-Path 'node_modules/.bin/vite.cmd')) {
  throw 'Vite is still missing after npm ci. Delete node_modules and run npm ci again.'
}

Write-Host 'Starting HALA.S at http://localhost:5173' -ForegroundColor Green
Write-Host 'Admin portal: http://localhost:5173/admin' -ForegroundColor Green
npm run dev -- --host 127.0.0.1
