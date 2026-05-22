# Satmon local setup script.
# Run from the repo root:  powershell -ExecutionPolicy Bypass -File .\setup.ps1

$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repoRoot

function Write-Step($msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn2($msg){ Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err2($msg) { Write-Host "    $msg" -ForegroundColor Red }

# 1. Check Node + npm
Write-Step 'Checking Node.js and npm'
$node = Get-Command node -ErrorAction SilentlyContinue
$npm  = Get-Command npm  -ErrorAction SilentlyContinue
if (-not $node -or -not $npm) {
    Write-Err2 'Node.js or npm not found on PATH.'
    Write-Host ''
    Write-Host 'Install Node.js 18 LTS or newer from https://nodejs.org/ and re-run this script.'
    Write-Host 'After installing, open a new PowerShell window so the updated PATH is picked up.'
    exit 1
}
Write-Ok ("node $(node --version)  npm $(npm --version)")

# 2. Install dependencies
Write-Step 'Installing npm dependencies'
if (Test-Path 'package-lock.json') {
    npm ci
} else {
    npm install
}
if ($LASTEXITCODE -ne 0) { Write-Err2 'npm install failed.'; exit 1 }
Write-Ok 'Dependencies installed.'

# 3. Copy Cesium runtime assets into public/cesium
#    Mirrors .github/workflows/deploy.yml so dev and prod resolve assets the same way.
Write-Step 'Copying Cesium runtime assets to public/cesium'
$cesiumSrc = Join-Path $repoRoot 'node_modules\cesium\Build\Cesium'
$cesiumDst = Join-Path $repoRoot 'public\cesium'
if (-not (Test-Path $cesiumSrc)) {
    Write-Err2 "Expected $cesiumSrc to exist after npm install. Aborting."
    exit 1
}
if (Test-Path $cesiumDst) { Remove-Item -Recurse -Force $cesiumDst }
New-Item -ItemType Directory -Path $cesiumDst | Out-Null
foreach ($sub in 'Workers','ThirdParty','Assets','Widgets') {
    Copy-Item -Recurse -Force (Join-Path $cesiumSrc $sub) (Join-Path $cesiumDst $sub)
}
Write-Ok 'Cesium assets copied.'

# 4. Bootstrap .env from .env.example if missing
Write-Step 'Checking .env'
$envPath     = Join-Path $repoRoot '.env'
$envExample  = Join-Path $repoRoot '.env.example'
if (Test-Path $envPath) {
    Write-Ok '.env already exists — leaving it alone.'
} else {
    if (-not (Test-Path $envExample)) {
        Write-Err2 '.env.example is missing — cannot bootstrap .env.'
        exit 1
    }
    Copy-Item $envExample $envPath
    Write-Warn2 '.env created from .env.example.'
    Write-Warn2 'Open .env and fill in REACT_APP_CESIUM_TOKEN before running `npm start`.'
    Write-Warn2 'Generate a token at https://cesium.com/ion/tokens'
}

Write-Step 'Done'
Write-Host '    Next steps:'
Write-Host '      1. Fill in REACT_APP_CESIUM_TOKEN in .env (if you have not already).'
Write-Host '      2. npm start'
