#!/bin/bash
# Build the deployable HestiaCP (Next.js panel) bundle.
#
# Produces dist/hestiang-panel-<version>.tar.gz containing the Next.js
# standalone tree (server.js + traced node_modules + static assets),
# the systemd unit, the nginx vhost, and the environment template —
# everything apps/panel/docs/cutover.md needs on the target host.
#
# Run from anywhere; the repo root is derived from this script's
# location. Uses the repo-pinned pnpm (packageManager field).
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PANEL_DIR="$(cd "$DEPLOY_DIR/.." && pwd)"
REPO_ROOT="$(cd "$PANEL_DIR/../.." && pwd)"
cd "$REPO_ROOT"

PNPM="${PNPM:-pnpm}"
VERSION="$(node -p "require('$PANEL_DIR/package.json').version")"
if git -C "$REPO_ROOT" rev-parse --short HEAD > /dev/null 2>&1; then
	VERSION="$VERSION+$(git -C "$REPO_ROOT" rev-parse --short HEAD)"
fi
OUT="$PANEL_DIR/dist/hestiang-panel-$VERSION"
TARBALL="$PANEL_DIR/dist/hestiang-panel-$VERSION.tar.gz"

echo "==> Installing (frozen, pinned toolchain)"
"$PNPM" install --frozen-lockfile

echo "==> Regenerating extracted data (locales, WebApp catalog)"
"$PNPM" --filter @hestiacp/panel i18n:extract
"$PNPM" --filter @hestiacp/panel webapps:extract

echo "==> Typechecking and testing the lib"
"$PNPM" --filter @hestiacp/lib typecheck
"$PNPM" --filter @hestiacp/lib test

echo "==> Production build"
"$PNPM" --filter @hestiacp/panel build

STANDALONE="$PANEL_DIR/.next/standalone"
if [ ! -f "$STANDALONE/apps/panel/server.js" ]; then
	echo "ERROR: standalone server.js not found at $STANDALONE/apps/panel" >&2
	exit 1
fi

echo "==> Assembling $OUT"
rm -rf "$OUT"
mkdir -p "$OUT"
cp -r "$STANDALONE/." "$OUT/"
mkdir -p "$OUT/apps/panel/.next"
cp -r "$PANEL_DIR/.next/static" "$OUT/apps/panel/.next/static"
if [ -d "$PANEL_DIR/public" ]; then
	cp -r "$PANEL_DIR/public" "$OUT/apps/panel/public"
fi
cp "$DEPLOY_DIR/hestiang-panel.service" "$OUT/"
cp "$DEPLOY_DIR/hestiang-panel.env" "$OUT/"
cp "$DEPLOY_DIR/nginx-vhost.conf" "$OUT/"
echo "$VERSION" > "$OUT/VERSION"

tar -czf "$TARBALL" -C "$PANEL_DIR/dist" "hestiang-panel-$VERSION"
echo "==> Bundle: $TARBALL"
