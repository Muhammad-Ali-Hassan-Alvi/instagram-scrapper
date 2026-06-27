param(
  [Parameter(Mandatory = $true)]
  [string]$Ec2Ip,

  [string]$User = "ec2-user"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$KeyPath = Join-Path $ProjectRoot "instagram-scraper-key.pem"
$EnvFile = Join-Path $ProjectRoot ".env.local"

if (-not (Test-Path $KeyPath)) {
  throw "Key not found: $KeyPath"
}
if (-not (Test-Path $EnvFile)) {
  throw ".env.local not found: $EnvFile"
}

Write-Host "Fixing key permissions..."
icacls $KeyPath /inheritance:r | Out-Null
icacls $KeyPath /grant:r "$($env:USERNAME):(R)" | Out-Null

$sshArgs = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new", "${User}@${Ec2Ip}")
$scpArgs = @("-i", $KeyPath, "-o", "StrictHostKeyChecking=accept-new")

Write-Host "Uploading bootstrap script..."
& scp @scpArgs "$ProjectRoot\scripts\ec2-bootstrap.sh" "${User}@${Ec2Ip}:~/ec2-bootstrap.sh"

Write-Host "Running bootstrap on EC2 (may take several minutes)..."
& ssh @sshArgs "chmod +x ~/ec2-bootstrap.sh && ~/ec2-bootstrap.sh"

Write-Host "Uploading .env.local..."
& scp @scpArgs $EnvFile "${User}@${Ec2Ip}:~/instagram-scrapper/.env.local"

$SessionFile = Join-Path $ProjectRoot ".auth\instagram-session.json"
if (Test-Path $SessionFile) {
  Write-Host "Uploading Instagram session..."
  ssh @sshArgs "mkdir -p ~/instagram-scrapper/.auth"
  & scp @scpArgs $SessionFile "${User}@${Ec2Ip}:~/instagram-scrapper/.auth/instagram-session.json"
} else {
  Write-Host "WARN: No .auth/instagram-session.json — run scrape locally first for full pagination on EC2"
}

Write-Host "Setting daily cron..."
$cronCmd = @'
( crontab -l 2>/dev/null | grep -v "npm run cron:once" || true; echo "0 6 * * * cd ~/instagram-scrapper && /usr/bin/npm run cron:once >> ~/scrape.log 2>&1" ) | crontab -
'@
& ssh @sshArgs "cd ~/instagram-scrapper && $cronCmd"

Write-Host "Starting scrape in background..."
& ssh @sshArgs "cd ~/instagram-scrapper && nohup npm run scrape:instagram > ~/scrape-run.log 2>&1 &"

Write-Host "Done."
Write-Host "Monitor logs: ssh -i `"$KeyPath`" ${User}@${Ec2Ip} tail -f ~/scrape-run.log"
