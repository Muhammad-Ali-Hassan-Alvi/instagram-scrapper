param(
  [Parameter(Mandatory = $true)]
  [string]$Ec2Ip,

  [string]$User = "ec2-user"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$KeyPath = Join-Path $ProjectRoot "instagram-scraper-key.pem"
$SessionFile = Join-Path $ProjectRoot ".auth\instagram-session.json"

if (-not (Test-Path $KeyPath)) {
  throw "Key not found: $KeyPath"
}
if (-not (Test-Path $SessionFile)) {
  throw "No session file. Run npm run scrape:instagram locally first to create .auth/instagram-session.json"
}

Write-Host "Uploading Instagram session to EC2..."
scp -i $KeyPath -o StrictHostKeyChecking=accept-new $SessionFile "${User}@${Ec2Ip}:~/instagram-scrapper/.auth/instagram-session.json"
Write-Host "Done. EC2 cron will reuse this session for full post pagination."
