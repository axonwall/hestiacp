#!/bin/bash
# Boot a built panel bundle and smoke-test it.
#
# Usage: smoke-bundle.sh <bundle-dir> [port]
#
# HESTIA_BIN must point at a directory of v-* commands (the lib test
# fixtures in CI, /usr/local/hestia/bin on a real host — where a login
# check additionally needs SMOKE_USER/SMOKE_SECRET credentials).
set -euo pipefail

BUNDLE="${1:?usage: smoke-bundle.sh <bundle-dir> [port]}"
PORT="${2:-3210}"
BIN="${HESTIA_BIN:?set HESTIA_BIN to a v-* command directory}"
SERVER="$BUNDLE/apps/panel/server.js"
[ -f "$SERVER" ] || { echo "ERROR: $SERVER missing — not a panel bundle" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'kill ${SRV:-} 2> /dev/null; rm -rf "$WORK"' EXIT
mkdir -p "$WORK/sessions" "$WORK/jobs"

cd "$BUNDLE/apps/panel"
HESTIA_BIN="$BIN" HESTIA_USE_SUDO=0 \
	HESTIA_SESSION_DIR="$WORK/sessions" HESTIA_JOB_DIR="$WORK/jobs" \
	HOSTNAME=127.0.0.1 PORT="$PORT" NODE_ENV=production \
	node server.js > "$WORK/server.log" 2>&1 &
SRV=$!

for i in $(seq 1 40); do
	if curl -sf --max-time 2 "http://127.0.0.1:$PORT/api/health" > /dev/null 2>&1; then
		break
	fi
	if ! kill -0 "$SRV" 2> /dev/null; then
		echo "ERROR: server exited during boot" >&2
		cat "$WORK/server.log" >&2
		exit 1
	fi
	sleep 0.5
done

curl -sf --max-time 5 "http://127.0.0.1:$PORT/api/health" | grep -q '"status":"ok"' \
	|| { echo "ERROR: /api/health did not report ok" >&2; exit 1; }
curl -sf --max-time 5 "http://127.0.0.1:$PORT/login" | grep -qi "login" \
	|| { echo "ERROR: /login did not render" >&2; exit 1; }

if [ -n "${SMOKE_USER:-}" ] && [ -n "${SMOKE_SECRET:-}" ]; then
	# Credential check needs the panel's server-action round trip;
	# CI covers it with the fixture suite instead. On a real host,
	# log in through a browser — see docs/cutover.md checklist.
	echo "note: credential smoke is manual (see cutover.md)"
fi

echo "smoke OK: bundle boots, /api/health reports ok, /login renders"
