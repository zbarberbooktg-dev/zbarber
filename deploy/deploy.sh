#!/usr/bin/env bash
#
# Zbarber deploy script — runs ON the VPS, invoked by GitHub Actions over SSH.
#
# Usage: deploy.sh <vitrine|admin|api> <prod|test>
#
# The calling GitHub Action is responsible for syncing the correct git branch
# into this checkout BEFORE invoking this script, e.g.:
#   git -C /srv/zbarber/<env> fetch --depth=1 origin <branch>
#   git -C /srv/zbarber/<env> reset --hard origin/<branch>
#   bash /srv/zbarber/<env>/deploy/deploy.sh <service> <env>
#
set -euo pipefail

SERVICE="${1:-}"
ENVIRONMENT="${2:-}"

usage() {
  echo "Usage: deploy.sh <vitrine|admin|api> <prod|test>" >&2
  exit 2
}

case "$SERVICE" in vitrine|admin|api) ;; *) usage ;; esac
case "$ENVIRONMENT" in prod|test) ;; *) usage ;; esac

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$REPO_ROOT"

echo "==> Deploying '$SERVICE' ($ENVIRONMENT) from $REPO_ROOT"

# Make pnpm available in non-interactive SSH shells.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
corepack enable >/dev/null 2>&1 || true

echo "==> Installing dependencies (pnpm install --frozen-lockfile)"
pnpm install --frozen-lockfile

case "$SERVICE" in
  vitrine|admin)
    # Vite reads PORT + BASE_PATH at config-eval time even for `build`.
    # On the VPS each app is served at the root of its own subdomain → BASE_PATH=/.
    echo "==> Building @workspace/$SERVICE (static)"
    BASE_PATH=/ PORT=4173 NODE_ENV=production \
      pnpm --filter "@workspace/$SERVICE" build
    echo "==> Static build ready: artifacts/$SERVICE/dist/public (served by nginx)"
    ;;
  api)
    echo "==> Building @workspace/api-server (esbuild bundle)"
    NODE_ENV=production pnpm --filter @workspace/api-server build
    echo "==> Restarting systemd service zbarber-api-$ENVIRONMENT"
    sudo systemctl restart "zbarber-api-$ENVIRONMENT"
    sleep 1
    sudo systemctl --no-pager --lines=15 status "zbarber-api-$ENVIRONMENT" || true
    ;;
esac

echo "==> Done: $SERVICE ($ENVIRONMENT)"
