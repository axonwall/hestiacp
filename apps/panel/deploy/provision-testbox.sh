#!/bin/bash
# Provision a THROWAWAY HestiaCP 1.10.5 test box and run the D10 gate:
# upstream's test/api.bats against the PHP panel (baseline), then the
# HestiaNG cutover flip, then api.bats again against the Next panel.
#
# Run as root on a FRESH Debian 12 or Ubuntu 22.04/24.04 host (VM/VPS,
# ≥2 vCPU / 4GB RAM / 30GB disk) with a public IP. This script installs
# a full Hestia stack — never run it on a machine you care about.
#
#   ./provision-testbox.sh <hostname-fqdn> <admin-email>
#
# Env knobs: ADMIN_PASSWORD (generated + printed if unset),
# FORK_REPO (default https://github.com/axonwall/hestiacp.git),
# BRANCH (default feat/hestiang-spike), SKIP_FLIP=1 to stop after the
# baseline run.
set -euo pipefail

HOSTNAME_FQDN="${1:?usage: provision-testbox.sh <hostname-fqdn> <admin-email>}"
ADMIN_EMAIL="${2:?usage: provision-testbox.sh <hostname-fqdn> <admin-email>}"
FORK_REPO="${FORK_REPO:-https://github.com/axonwall/hestiacp.git}"
BRANCH="${BRANCH:-feat/hestiang-spike}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-$(head -c 18 /dev/urandom | base64 | tr -d '/+=' | head -c 20)}"
WORK=/root/hestiang-test
mkdir -p "$WORK"

[ "$(id -u)" = "0" ] || {
	echo "run as root" >&2
	exit 1
}
. /etc/os-release
case "$ID:$VERSION_ID" in
	debian:12 | ubuntu:22.04 | ubuntu:24.04) ;;
	*) echo "WARN: untested OS $PRETTY_NAME — Hestia supports Debian 12 / Ubuntu LTS" >&2 ;;
esac

echo "==> [1/6] Installing stock HestiaCP (this takes a while)"
if [ -d /usr/local/hestia/data/users/admin ] && [ "${FORCE_INSTALL:-0}" != "1" ]; then
	echo "    Hestia already installed — skipping to stage 2 (the installer reboots the host, which kills this script; just re-run it)"
	SKIP_INSTALL=1
fi
export HESTIA=/usr/local/hestia
export PATH="$PATH:/usr/local/hestia/bin"
if [ "${SKIP_INSTALL:-0}" != "1" ]; then
	export DEBIAN_FRONTEND=noninteractiveapt-get update -qq && apt-get install -y -qq curl wget git jq > /dev/null
	cd "$WORK"
	[ -f hst-install.sh ] || wget -q https://raw.githubusercontent.com/hestiacp/hestiacp/main/install/hst-install.sh
	# Lean profile: no multiphp / clamav / spamassassin / quota; DNS, mail
	# and the web terminal stay on so every panel surface exists. `yes`
	# feeds the installer's continue prompt — --force alone does not skip
	# it, and with stdin closed it aborts after the component list.
	yes | bash hst-install.sh \
		--hostname "$HOSTNAME_FQDN" \
		--email "$ADMIN_EMAIL" \
		--username admin \
		--password "$ADMIN_PASSWORD" \
		--port 8083 \
		--api yes \
		--multiphp no \
		--clamav no \
		--spamassassin no \
		--quota no \
		--webterminal yes \
		--force

fi

echo "==> [2/6] Preparing the api.bats environment"
if [ "${SKIP_INSTALL:-0}" = "1" ]; then
	v-change-user-password admin "$ADMIN_PASSWORD" > /dev/null 2>&1 || true
fi
# Test-box API posture: api.bats curls the panel's public hostname
# (the box's own public IP is the client IP, which the stock
# API_ALLOWED_IP rejects) and its cluster tests need DNS_CLUSTER on.
v-change-sys-config-value API_ALLOWED_IP 'allow-all' > /dev/null
v-change-sys-config-value DNS_CLUSTER 'yes' > /dev/null
API_HASH="$(v-generate-api-key admin 2> /dev/null | tail -1)"
[ -n "$API_HASH" ] || {
	echo "could not generate the admin API hash" >&2
	exit 1
}
# Access-key permissions are named profiles in $HESTIA/data/api, not
# raw commands. sync-dns-cluster matches what api.bats exercises: the
# key may list users (the DNS sync flow) but must NOT hold v-add-user
# (one test asserts the permission denial).
ACCESS_OUT="$(v-add-access-key admin sync-dns-cluster api-test 2> /dev/null)"
ACCESS_ID="$(echo "$ACCESS_OUT" | sed -n 's/^ACCESS_KEY_ID:[[:space:]]*//p')"
ACCESS_SECRET="$(echo "$ACCESS_OUT" | sed -n 's/^SECRET_ACCESS_KEY:[[:space:]]*//p')"
[ -n "$ACCESS_ID" ] && [ -n "$ACCESS_SECRET" ] || {
	echo "could not create the test access key" >&2
	exit 1
}
cat > /tmp/hestia-api-env.sh << EOF
server="$HOSTNAME_FQDN"
port="8083"
apikey="$API_HASH"
accesskey="$ACCESS_ID:$ACCESS_SECRET"
accesssecret="$ACCESS_SECRET"
password="$ADMIN_PASSWORD"
EOF
echo "    env written to /tmp/hestia-api-env.sh (admin password: $ADMIN_PASSWORD)"

echo "==> [3/6] Cloning the fork and the bats helpers"
cd "$WORK"
if [ -d hestiacp ]; then
	git -C hestiacp pull -q --ff-only origin "$BRANCH" || true
else
	git clone -q --branch "$BRANCH" "$FORK_REPO" hestiacp
fi
cd hestiacp
git submodule update --init test/test_helper > /dev/null 2>&1 || true
export BATS="$WORK/hestiacp/test/test_helper/bats-core/bin/bats"

echo "==> [4/6] BASELINE: api.bats against the PHP panel"
"$BATS" test/api.bats 2>&1 | tee "$WORK/api-baseline.log" \
	|| echo "!! baseline had failures — see $WORK/api-baseline.log"

if [ "${SKIP_FLIP:-0}" = "1" ]; then
	echo "SKIP_FLIP=1 — box ready at https://$HOSTNAME_FQDN:8083 (PHP panel)"
	exit 0
fi

echo "==> [5/6] Building + installing the Next panel bundle"
corepack enable > /dev/null 2>&1 || npm install -g pnpm@12.9.1 > /dev/null
corepack prepare pnpm@12.9.1 --activate > /dev/null 2>&1 || true
PNPM="$(command -v pnpm)" ./apps/panel/deploy/build-bundle.sh
# Newest by mtime: dist/ accumulates one bundle per commit, and
# an alphabetical ls picks the OLDEST (the first live flip was
# silently reinstalled three times this way).
BUNDLE="$(ls -dt apps/panel/dist/hestiang-panel-*/ | head -1)"
tar -xzf "$(ls -t apps/panel/dist/hestiang-panel-*.tar.gz | head -1)" -C /usr/local/hestia/
rm -rf /usr/local/hestia/web-next
mv "/usr/local/hestia/$(basename "$BUNDLE")" /usr/local/hestia/web-next
install -d -o hestiaweb -g hestiaweb /usr/local/hestia/data/jobs
cp /usr/local/hestia/web-next/hestiang-panel.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hestiang-panel
for i in $(seq 1 30); do
	curl -sf http://127.0.0.1:8093/api/health > /dev/null && break || sleep 1
done
curl -s http://127.0.0.1:8093/api/health
echo

echo "==> [6/6] Flip the vhost + CUTOVER: api.bats against the Next panel"
NGINX_CONF="$(find /usr/local/hestia/nginx -name nginx.conf | head -1)"
cp "$NGINX_CONF" "$NGINX_CONF.pre-hestiang"
python3 - "$NGINX_CONF" /usr/local/hestia/web-next/nginx-vhost.conf << 'PYEOF'
import re, sys
conf_path, vhost_path = sys.argv[1], sys.argv[2]
conf = open(conf_path).read()
vhost = open(vhost_path).read()
# Replace the first balanced server { ... } block with the cutover vhost.
start = conf.index("\n\tserver {") + 1
depth, i = 0, start
while True:
    if conf[i] == "{": depth += 1
    elif conf[i] == "}":
        depth -= 1
        if depth == 0: break
    i += 1
open(conf_path, "w").write(conf[:start] + vhost.strip() + conf[i + 1:])
print(f"server block replaced in {conf_path}")
PYEOF
# The panel nginx binary is hestia-nginx, not nginx.
"$(command -v hestia-nginx || echo /usr/local/hestia/nginx/sbin/hestia-nginx)" -t -c "$NGINX_CONF"
systemctl reload hestia || /usr/local/hestia/bin/v-restart-service hestia || true
"$BATS" test/api.bats 2>&1 | tee "$WORK/api-cutover.log" \
	|| echo "!! cutover run had failures — see $WORK/api-cutover.log"

echo
echo "DONE. Panel: https://$HOSTNAME_FQDN:8083  admin / $ADMIN_PASSWORD"
echo "Logs: $WORK/api-baseline.log (PHP) · $WORK/api-cutover.log (Next)"
echo "Rollback: cp $NGINX_CONF.pre-hestiang $NGINX_CONF && reload hestia nginx"
