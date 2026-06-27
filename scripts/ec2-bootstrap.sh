#!/usr/bin/env bash
# Amazon Linux 2023 — one-time scraper worker setup
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Muhammad-Ali-Hassan-Alvi/instagram-scrapper.git}"
APP_DIR="${APP_DIR:-$HOME/instagram-scrapper}"

echo "==> System packages"
sudo dnf update -y
sudo dnf install -y git

echo "==> Node.js 20"
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
  sudo dnf install -y nodejs
fi
node -v
npm -v

echo "==> Swap (helps Playwright on 1 GiB RAM)"
if ! swapon --show | grep -q /swapfile; then
  sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
fi

echo "==> Clone / update repo"
if [ -d "$APP_DIR/.git" ]; then
  cd "$APP_DIR"
  git pull origin main
else
  git clone "$REPO_URL" "$APP_DIR"
  cd "$APP_DIR"
fi

echo "==> npm install"
npm install

echo "==> Playwright system deps (Amazon Linux)"
sudo dnf install -y \
  alsa-lib atk at-spi2-atk at-spi2-core cairo cups-libs dbus-libs \
  libX11 libXcomposite libXdamage libXext libXfixes libXi libXrandr libXrender libXtst \
  mesa-libgbm nspr nss pango libxkbcommon vulkan \
  xorg-x11-fonts-Type1 xorg-x11-fonts-misc

echo "==> Playwright Chromium"
npx playwright install chromium

echo "==> Cron daemon"
sudo dnf install -y cronie
sudo systemctl enable crond
sudo systemctl start crond

if [ -f "$APP_DIR/.env.local" ]; then
  echo "==> Daily cron (06:00 UTC)"
  CRON_LINE="0 6 * * * cd $APP_DIR && /usr/bin/npm run cron:once >> $HOME/scrape.log 2>&1"
  ( crontab -l 2>/dev/null | grep -v "npm run cron:once" || true; echo "$CRON_LINE" ) | crontab -
else
  echo "WARN: .env.local not found yet — cron will be set after env upload."
fi

echo "==> Bootstrap complete"
