# @hestiacp/panel — HestiaCP (Next.js panel) · HestiaNG spike

A vertical-slice spike for the HestiaCP → Next.js conversion (Scope A of the
plan in `~/workspace/your_files/hestiacp-nextjs-conversion-plan-2026-10-23.md`):
**login → users list → user detail → one edit**, all through the real `v-*`
command layer via `@hestiacp/lib`. Stack per decisions D1–D9: Next.js 16,
React 19, server-side sessions, root pnpm monorepo.

## Run it against the fixtures (no Hestia install needed)

From the repo root:

```sh
pnpm install --filter @hestiacp/panel --filter @hestiacp/lib
HESTIA_BIN="$PWD/packages/hestiacp_lib/test/fixtures/bin" \
HESTIA_USE_SUDO=0 \
pnpm --filter @hestiacp/panel dev
```

Open http://localhost:3000 — login is **admin / spike-fixture-secret**
(fixture credential, only valid against the test doubles in
`packages/hestiacp_lib/test/fixtures/bin`). Saving the name on a user page
appends the `v-change-user-name` invocation to
`/tmp/hestiang-fixture-calls.log`, so the edit is provable end-to-end.

Against a real install, omit both variables: the defaults are
`/usr/local/hestia/bin` through `sudo`, as the PHP panel does.

## Verify

```sh
pnpm --filter @hestiacp/lib test        # client + session store, against fixtures
pnpm --filter @hestiacp/lib typecheck
pnpm --filter @hestiacp/panel typecheck
pnpm --filter @hestiacp/panel build     # production build is the gate (D7)
```

## Phase 1 shell (2026-10-23)

On top of the spike slice, the production shell pieces are in:

- **PHP-format sessions.** The session store is the lib's PhpSessionStore:
  `sess_<id>` files in PHP's own serialization under the production
  `HESTIASID` cookie, so FileGator (/fm/) and the web terminal's auth
  shim keep working untouched. The session record is built like
  main.php's: every sys-config key merged in at login and refreshed per
  request, userContext from the account record's ROLE, a CSRF token,
  language, combined IP, LAST_ACTIVITY. Per-request main.php discipline
  is mirrored in `requireSession` (deleted user / revoked admin role /
  suspended account destroy the session).
- **CSRF tokens** on mutating forms (session token, hidden field,
  verified in the action — see the user edit form).
- **Legacy API shim** at `POST /api` (D4), a thin adapter over the lib's
  dispatcher: legacy + access-key auth, IP allowlist, exit-code mapping,
  `Hestia-Exit-Code` header, `v-make-tmp-file` special case.
- **Satellite links** in the top bar, gated by the sys-config flags
  exactly as PHP gates them (FILE_MANAGER → /fm/, WEB_TERMINAL →
  /list/terminal/; the terminal page itself is a Phase 4 placeholder).

## Phase 1 user administration (2026-10-23)

- **Users**: add (`/add/user`), full edit (`/users/[user]` — name, contact,
  password, package, shell, role, language, theme, nameservers,
  login-disabled; **one command per changed field only**, mirroring the
  PHP page's discipline), suspend/unsuspend from the list, and delete
  behind a confirm page that refuses the caller's own account and the
  ROOT_USER. Admin-only surfaces are gated by `requireAdmin`; non-admins
  can edit only themselves.
- **Packages**: list, add (prefilled from `default`), edit (force-save via
  the staged definition file), delete behind a confirm page.

## Phase 1 auth completion (2026-10-23)

- **2FA (TOTP)**: accounts with TWOFA set get a two-step login — the
  password step parks a *pending* session (no credentials in it; PHP
  parks the password itself, we don't), the code step verifies via
  `v-check-user-2fa` and promotes the session in place. Enable/disable
  lives on the user page (`v-add-user-2fa` / `v-delete-user-2fa`); the
  secret + QR show there from the account record, as in PHP.
- **Login-as**: admins impersonate via the users list; `look` is set on
  the session, both `v-log-action` audit lines are written with PHP's
  messages, a banner offers Return, and while looking, the panel scopes
  to the looked account (their page, their shell/role, self-edit rules).
- **IP binding**: `requireSession` enforces main.php's rule — a session
  used from a different IP than `user_combined_ip` is destroyed and the
  logout logged (`v-log-user-logout`), unless `DISABLE_IP_CHECK=yes`.
  Login attempts are logged via `v-log-user-login`.

## i18n pipeline + CI (Phase 1 complete, 2026-10-23)

- **Translations reuse HestiaCP's own gettext catalogs.** The repo ships
  only compiled `.mo` files (the .po sources live in Crowdin), so
  `scripts/extract-locales.mjs` parses the .mo binaries directly into
  `apps/panel/locales/<lang>.json` — 42 catalogs, 22,786 translated
  strings. Run it with `pnpm --filter @hestiacp/panel i18n:extract`
  after pulling upstream translation updates.
- **Runtime** (`lib/i18n.ts`): gettext semantics — the session's
  `language` (from the account record, refreshed per request) selects
  the dictionary; a missing string falls back to the msgid (the English
  source), so wrapping a string in `t()` is always safe. Interpolation
  is sprintf-style (`%s`, `%1$s`), matching the PHP panel. The shell
  slice (layout, login, 2FA, user list) is wired; domain pages get
  wired as they are built in Phases 2–3.
- **CI** (`.github/workflows/hestiang.yml`, additive to upstream's):
  frozen-lockfile install with pinned pnpm 12.9.1, lib tests, typecheck,
  locale-freshness gate (extract + `git diff --exit-code`), and the
  production build as the final gate.

## Phase 2 — read-only lists + dashboard (2026-10-23)

All list views are read-only and render through one shared component
(`components/ListView.tsx`) fed by typed lib wrappers over the
`v-list-*` commands; lists act for the effective user (the impersonation
target while looking, as in PHP) and admin views are behind
`requireAdmin`.

- **User views**: /list/web, /list/dns (+ /records per domain),
  /list/mail (+ /accounts per domain), /list/db, /list/cron,
  /list/backup, /list/key (SSH), /list/access-key, /list/log,
  /list/notifications, /list/stats.
- **Admin views**: /list/server (sys-info card + services),
  /list/ip, /list/firewall (+ /banlist, /ipset), /list/updates,
  /list/rrd (data series; charts are theme work).
- **Dashboard** (/dashboard): package-quota gauges from the account
  record's U_* counters (disk, bandwidth, domain/db/cron/backup counts)
  plus the monthly stats table.
- A section nav (translated via the Phase 1 i18n pipeline) links them.

Not yet: the detail sub-views (backup detail/incremental/exclusions,
SSL list, webapps, web-log streaming, search) — they land with their
Phase 3/4 edit counterparts. Sorting/pagination is server-order for
now, as the fixtures and most v-list outputs are already ordered.

## Phase 3 (first tranche) — CRUD for web / DNS / mail / db / cron (2026-10-23)

Full create/edit/delete/suspend for the five core domains, mirroring
the PHP pages' command sequences and changed-only discipline:

- **Web** (/add/web, /edit/web, /delete/web, list toggles): add with
  optional DNS zone (created with the IP's NAT/public address, as PHP)
  and mail domain; edit = IP (moves the zone too), templates (admin),
  proxy add/change/delete, alias diff, Let's Encrypt on/off, SSL
  force/HSTS, remove plain cert, FastCGI cache, stats system; any
  change restarts web + proxy.
- **DNS** (/add/dns with a record form, /edit/dns, /edit/dns/record,
  /delete/dns + record): zone fields incl. SOA/exp/TTL/DNSSEC with
  restart-on-change; records add/edit (incl. record-ID change),
  suspend, delete.
- **Mail** (/add/mail, /add/mail/account, /edit/mail,
  /edit/mail/account, deletes, toggles): domain toggles
  antispam/antivirus/DKIM (selector change regenerates), reject,
  catchall add/change/delete, rate limit (admin); accounts with staged
  passwords, quota, alias/forwarder diffs, fwd-only, autoreply.
- **Databases** (/add/db, /edit/db, /delete/db): names are suffixes —
  the commands prefix `<user>_` themselves; user change + password.
- **Cron** (/add/cron, /edit/cron, /delete/cron): whole-schedule
  replace, as PHP does.

## Phase 3 extras — cert upload, FTP, mail webmail/relay/SSL (2026-10-23)

The deferred sections of the five domains, in their own forms on the
edit pages (each submits independently, changed-only):

- **Web SSL certificate**: current cert metadata + crt/key/ca textareas
  prefilled from v-list-web-domain-ssl; changes stage <domain>.crt/.key
  /.ca in a temp dir for v-change-web-domain-sslcert, then restart
  web + proxy.
- **FTP accounts**: per-account path + password forms and an add form.
  PHP's asymmetry is preserved — add takes the username suffix (the
  command prefixes <user>_ itself), changes take the full username.
  Secrets are staged; the credentials email PHP sends is not
  reproduced.
- **Mail webmail + SMTP relay**: alias add/delete by change; relay
  (re)add stages the password. One deliberate deviation: changing relay
  settings without re-entering the password is refused, where PHP
  would stage the empty field and clobber the stored credential.
- **Mail SSL**: Let's Encrypt via the mail variant (blank-space alias
  arg, trailing 'yes'), custom certs staged for v-add-mail-domain-ssl
  / v-change-mail-domain-sslcert, removal, v-restart-mail on change.
  The add-mail form can also set webmail + relay at creation.

## Phase 3 remainder — stats users, backups, firewall/IPs, server (2026-10-23)

Phase 3 is complete:

- **Stats users** (edit/web): the single per-domain stats auth user —
  add/reset via v-add-web-domain-stats-user (staged password), removal
  via v-delete-web-domain-stats-user.
- **Backups**: schedule from the list; detail page (v-list-user-backup);
  restore page — full or per-section (web/DNS/mail/db/user-dirs by
  object, cron as a whole) via v-schedule-user-restore in PHP's exact
  argument shape; confirm-page delete; exclusions editor (five
  KEY='csv' lines staged for v-update-user-backup-exclusions, per-
  system clear). Download: PHP delegates bytes to nginx via
  X-Accel-Redirect — the standalone panel streams the file itself
  under the same access rule (admin any, users only their own
  prefix), and schedules v-schedule-user-backup-download when the
  archive is not local yet. /list/files redirects to FileGator (/fm/),
  which authenticates off the same session files.
- **Firewall & IPs** (admin): rule add/edit/delete (port input
  normalized spaces→commas as PHP), ban add/remove, ipset add/remove;
  IP add/edit (status/owner/name/NAT, changed-only)/delete.
- **Server settings** (admin): basic form (hostname, timezone,
  language + apply-to-users, theme, release branch, backup mode/level
  /dir, debug mode — changed-only); feature toggles with add/delete
  command pairs (firewall, file manager, web terminal, quota); remote
  backup hosts (staged credentials) + restic host with retention
  keeps; service start/stop/restart on /list/server; and ONE service
  config editor for every web/edit/server/<service> archetype (fixed
  paths for the well-known services, v-list-sys-<service>-config
  CONFIG.config_path for the rest, read via v-open-fs-config, saved
  staged via v-change-sys-service-config).

Not covered from the PHP mega-form: the long tail of one-off policy
config values, DNS-cluster remote hosts, and the whitelabel editor —
candidates for a later settings tranche.

## Phase 4 — WebApp framework, search, restic views (2026-10-23)

- **WebApp framework port** (web/src, the hidden second PHP layer):
  the lib gains HestiaAppContext (the HestiaApp primitives —
  v-*-fs-* file ops, v-run-cli-cmd runners for wp-cli/composer/php,
  the wget download helper, database creation with the limit check,
  template changes, sendPostRequest resolved to localhost), a
  BaseSetup::install port (resources → database → templates → app
  setup), and a file-backed **job runner** (JobStore + startJob):
  installs run detached and persist status as JSON records, where
  PHP held the request open for up to 300s. setupApplication ports
  exist for **WordPress and DokuWiki**; the other 20 installers are
  catalogued but refuse to install until ported — no fake installs.
- **Catalog**: scripts/extract-webapps.mjs parses the 22 PHP setup
  classes into data/webapps.json (info + form schemas + database
  flag); /list/webapps renders the cards per domain (linked from the
  web domain edit page), /add/webapp renders the wizard form from the
  schema (plus install directory, PHP version from v-list-sys-php ∩
  the app's supported list, and the database block) and queues the
  job; /list/jobs shows records.
- **Search**: /search (topbar form) — v-search-object for admins,
  v-search-user-object otherwise or with ?u=; results link to the
  matching edit pages.
- **Restic views**: snapshot list (newest first), detail with
  full/per-object restore forms in the schedule endpoint's argument
  shapes (cron passes the type alone), confirm-page delete, and
  scheduling new incremental backups.

Not ported: the remaining 20 setupApplication implementations,
the restic file browser (v-list-user-files-restic), and the
terminal page (the bundled terminal service already shares the
panel's PHP-format sessions; the page remains a hand-off).

## Remaining limitations (deliberate, later phases)

- Package template fields are text inputs, not the PHP form's
  template-select dropdowns.
- Visuals are placeholder-minimal: D6 is parity-first, and the theme port
  is Phase 2 work.
- `test/api.bats` against a real install still needs D10 (a throwaway
  Hestia 1.10.5 box); everything is fixture-verified until then.
