#!/usr/bin/env bash
#
# One-time VPS bootstrap for Zbarber (Ubuntu 24.04, run as root).
#
# Installs Node.js 24, pnpm (via corepack), nginx, certbot, ufw; creates the
# `zbarber` service user, the /srv/zbarber/{prod,test} layout and /etc/zbarber.
# Idempotent-ish: safe to re-run, but review before each run.
#
# Usage:  sudo bash provision-vps.sh
#
# After this, follow deploy/README.md to: clone the repo into both checkouts,
# drop the env files, install the systemd units + nginx sites, and run certbot.
#
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root (sudo bash provision-vps.sh)." >&2
  exit 1
fi

echo "==> apt update + base packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y curl git ca-certificates gnupg ufw nginx

echo "==> Install Node.js 24 (NodeSource)"
if ! command -v node >/dev/null 2>&1 || ! node -v | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y nodejs
fi
node -v

echo "==> Enable pnpm via corepack"
corepack enable
corepack prepare pnpm@latest --activate || true
pnpm -v || true

echo "==> Install certbot (nginx plugin)"
apt-get install -y certbot python3-certbot-nginx

echo "==> Create service user 'zbarber'"
if ! id zbarber >/dev/null 2>&1; then
  useradd --system --create-home --shell /bin/bash zbarber
fi

echo "==> Create directories"
mkdir -p /srv/zbarber/prod /srv/zbarber/test /etc/zbarber
chown -R zbarber:zbarber /srv/zbarber
chmod 750 /etc/zbarber

echo "==> Allow zbarber to restart the API services without a password"
cat >/etc/sudoers.d/zbarber-systemctl <<'EOF'
zbarber ALL=(root) NOPASSWD: /usr/bin/systemctl restart zbarber-api-prod, /usr/bin/systemctl restart zbarber-api-test, /usr/bin/systemctl start zbarber-api-prod, /usr/bin/systemctl start zbarber-api-test, /usr/bin/systemctl stop zbarber-api-prod, /usr/bin/systemctl stop zbarber-api-test, /usr/bin/systemctl status zbarber-api-prod, /usr/bin/systemctl status zbarber-api-test
EOF
chmod 440 /etc/sudoers.d/zbarber-systemctl

echo "==> Configure ufw firewall (allow SSH, HTTP, HTTPS)"
ufw allow OpenSSH || ufw allow 22/tcp
ufw allow 'Nginx Full'
ufw --force enable
ufw status verbose

echo
echo "==> Base provisioning done."
echo "    Next steps are in deploy/README.md:"
echo "      1. Add a GitHub deploy key for the zbarber user and clone the repo"
echo "         into /srv/zbarber/prod (branch main) and /srv/zbarber/test (branch test)."
echo "      2. Create /etc/zbarber/api-prod.env and api-test.env (see deploy/env/api.env.example)."
echo "      3. Install systemd units + nginx sites, then run certbot for the 6 domains."
