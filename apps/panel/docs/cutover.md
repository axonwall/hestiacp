# Phase 5 — cutover runbook (Next.js panel)

The strangler cutover: Hestia's nginx switches :8083 from the PHP
tree to the Next.js panel. The PHP tree is **never modified** — the
flip is one nginx server block plus one systemd unit, and rollback
is restoring the block. Sessions are shared (the Next panel writes
the same PHP-format session files FileGator and the web terminal
authenticate against), so users stay logged in across the flip in
both directions.

## What ships where

| Piece | Source | Target on host |
|---|---|---|
| Panel bundle | `apps/panel/deploy/build-bundle.sh` | `/usr/local/hestia/web-next/` |
| Service | `deploy/hestiang-panel.service` | `/etc/systemd/system/` |
| Environment | `deploy/hestiang-panel.env` | `/usr/local/hestia/web-next/` |
| Vhost | `deploy/nginx-vhost.conf` | replaces the `server {}` block in Hestia nginx's `nginx.conf` |

Runtime: the installer's own Node.js — `hst-install` already
installs **Node 24 LTS from NodeSource** for the web terminal
(`node_v="24"`), which satisfies Next 16's ≥20.9 floor. No bundled
runtime is needed; the preflight below asserts the version.

The service runs as **hestiaweb**, so the existing sudoers rule
(`hestiaweb ALL=NOPASSWD:/usr/local/hestia/bin/*`) authorizes every
engine command, exactly as for the PHP panel's php-fpm pool. php-fpm
keeps running — FileGator (`/fm/`) is still PHP.

## Automated path (throwaway test box)

`deploy/provision-testbox.sh <hostname> <admin-email>`, run as root
on a fresh Debian 12 / Ubuntu LTS host, performs the whole gate:
stock Hestia install → api.bats baseline against PHP → bundle build
and service install → this flip → api.bats against the Next panel,
with both logs kept side by side. That is the D10 verification path.

## Preflight

1. `node --version` → ≥ 20.9 (expect a 24.x from NodeSource).
2. A bundle built from the exact commit to deploy:
   `apps/panel/deploy/build-bundle.sh` (frozen install, lib tests,
   production build — all green before it produces a tarball).
3. `deploy/smoke-bundle.sh <bundle-dir>` against the lib fixtures
   passes on the build machine.
4. On the host: backup taken; a maintenance window agreed. The flip
   itself is a reload, not a restart.

## Install (host, root)

```sh
tar -xzf hestiang-panel-<version>.tar.gz -C /usr/local/hestia/
mv /usr/local/hestia/hestiang-panel-<version> /usr/local/hestia/web-next
install -d -o hestiaweb -g hestiaweb /usr/local/hestia/data/jobs
cp /usr/local/hestia/web-next/hestiang-panel.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hestiang-panel
curl -s http://127.0.0.1:8084/api/health   # {"status":"ok", ...}
```

## Flip

1. Back up the live vhost:
   `cp /usr/local/hestia/nginx/conf/nginx.conf{,.pre-hestiang}` (path
   per the hestia-nginx package layout on the host).
2. Replace its `server {}` block with `deploy/nginx-vhost.conf`.
3. `nginx -t` against the Hestia nginx instance, then reload it.
4. Run the smoke checklist.

## Smoke checklist (post-flip)

- [ ] Login as admin; a **pre-flip PHP session still works** (shared
      session files).
- [ ] Login with a 2FA account; login-as + return.
- [ ] Users/domains lists render; one changed-only edit lands
      (check the engine log).
- [ ] Legacy API: `test/api.bats` against the host (D4/D10 gate) or
      at minimum one hash-auth and one access-key call.
- [ ] FileGator opens from the top bar (PHP, shared session).
- [ ] Web terminal opens (shared session).
- [ ] Backup download streams; a WebApp install queues and completes
      in /list/jobs.
- [ ] German (or any non-English) account renders translated.

## Rollback

Restore `nginx.conf.pre-hestiang`, reload Hestia nginx, optionally
`systemctl disable --now hestiang-panel`. The PHP panel resumes
exactly where it left off; sessions written by the Next panel remain
valid for it.

## Known coexistence notes

- **php-fpm stays** for FileGator only. Removing it is a post-cutover
  decision tied to a FileGator replacement, not part of this flip.
- **phpMyAdmin / webmail** are unchanged (plain links, as in PHP).
- The Next panel binds 127.0.0.1:8084 only; :8083 remains the single
  public entry via nginx. BACKEND_PORT customization (hst-install
  `--port`) still applies at the nginx listener.
- After the flip, upstream merges keep flowing into bin/func/install
  and web/ (the PHP tree stays in the repo for FileGator and as the
  rollback target); panel-facing changes land in apps/panel.
