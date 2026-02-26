# Build HoloVox with only project dependencies (no torch, pandas, etc.)
# Creates a clean venv, installs requirements + pyinstaller, then builds.

$ErrorActionPreference = "Stop"
$ProjectRoot = $PSScriptRoot
$VenvPath = Join-Path $ProjectRoot ".build_venv"

Write-Host "=== HoloVox minimal build ===" -ForegroundColor Cyan

# Create fresh venv
if (Test-Path $VenvPath) {
    Write-Host "Removing existing build venv..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force $VenvPath
}

Write-Host "Creating build venv..." -ForegroundColor Green
python -m venv $VenvPath
$python = Join-Path $VenvPath "Scripts\python.exe"
$pip = Join-Path $VenvPath "Scripts\pip.exe"

# Install only project deps + pyinstaller
Write-Host "Installing project dependencies..." -ForegroundColor Green
& $pip install --upgrade pip --quiet
& $pip install -r (Join-Path $ProjectRoot "requirements.txt") --quiet
& $pip install pyinstaller --quiet

# Build
Write-Host "Running PyInstaller..." -ForegroundColor Green
$pyinstaller = Join-Path $VenvPath "Scripts\pyinstaller.exe"
& $pyinstaller --noconfirm --clean (Join-Path $ProjectRoot "HoloVox.spec")

Write-Host "`nBuild complete: dist\HoloVox.exe" -ForegroundColor Cyan
