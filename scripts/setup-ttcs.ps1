$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$VendorDir = Join-Path $ProjectRoot "vendor\tiktok-content-scraper"
$RepoUrl = "https://github.com/Q-Bukold/TikTok-Content-Scraper.git"

Write-Host "Setting up TikTok-Content-Scraper at $VendorDir"

if (-not (Test-Path $VendorDir)) {
    git clone $RepoUrl $VendorDir
} else {
    Write-Host "Vendor already exists - pulling latest..."
    Push-Location $VendorDir
    git pull --ff-only
    Pop-Location
}

Write-Host "Installing Python dependencies..."
python -m pip install -r (Join-Path $VendorDir "requirements.txt")
python -m pip install -r (Join-Path $ProjectRoot "scripts\tiktok-content-scraper\requirements.txt")

Write-Host 'Done. Run: npm run scrape:tiktok:ttcs'
