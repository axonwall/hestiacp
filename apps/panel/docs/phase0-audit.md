# Phase 0 remainder — direct-I/O audit and app hand-offs

Companion to the conversion plan (D1 Scope A). Audited 2026-10-23 against
upstream `main` c4f0ae0 (v1.10.5), the tree the spike branch is based on.
Method: every PHP file under `web/` was scanned for filesystem calls, and
each hit was read in context. This closes the two Phase 0 items the first
inventory pass left open.

## Count reconciliation

The first-pass inventory said "45 files do direct file I/O" — that was a
narrow pattern (`file_get_contents|fopen|readfile|file_put_contents`). The
full audit casts a wider net (also `tempnam`, `tmpfile`, `glob`,
`file_exists`, `unlink`, `touch`, …): 58 raw hits, of which **3 are false
positives** (`web/copy/package` — the match is a `v-copy-*` command string;
two template files matching the word "copy" in clipboard HTML) and
**55 files make genuine filesystem calls**. All 55 are classified below.
The good news the audit surfaces: the panel's direct I/O is not 55 problems —
it is **one pattern repeated**, plus a short tail.

## The one pattern: stage a file, hand its path to a `v-*` command

Almost everything is temp-file staging: write content to a file under
`/tmp`, pass the _path_ as an argument to a `v-*` command, delete the file.
The bash layer — not the panel — owns whatever the file describes. That is
exactly the pattern the spike's `verifyUserPassword` already implements, so
each category below collapses into a single `@hestiacp/lib` helper.

### S — Secret staging (10 files) → lib `withSecretFile()`

Write a secret (password/hash) to a 0600 temp file; the command reads it
from the path (`func/main.sh`'s `is_password_valid` / `is_hash_valid` swap
in file contents for `^/tmp/` arguments). The secret never appears in argv.

`web/add/db`, `web/add/mail` (×2: relay secret + account secret),
`web/add/user`, `web/edit/db`, `web/edit/user`, `web/login` (hash file for
`v-check-user-hash`; already ported in the spike), `web/reset` (reset key +
new password), `web/reset/mail` (new mail password), `web/edit/server`
(MySQL root + SMTP relay secrets), `web/api` (hash file for legacy auth).

### P — Package-definition staging (2 files) → lib `stageFile()`

`web/add/package`, `web/edit/package`: serialize the package definition to
a temp file → `v-add-user-package <file> <name> [force]`.

### C — Service-config staging (23 files) → lib `changeServiceConfig()`

`web/edit/server/{apache2, bind9, clamav-daemon, dovecot, exim, exim4,
fail2ban, hestiaweb, httpd, mariadb, mysql, mysqld, named, nginx, php,
php-fpm, php5-fpm, postgresql, proftpd, spamassassin, spamd, ssh, vsftpd}` —
one archetype, copy-pasted 23 times: `mktemp` a file with the edited config
(CRLF-normalized), call `v-change-sys-service-config <file> <service>
<restart>`, unlink. The read side is **already a command**:
`v-open-fs-config <path>` returns the live config (it is the most-called
command from the whole panel — 25 files). One lib pair
(`openFsConfig` + `changeServiceConfig`) replaces all 23 files in Phase 3's
server-settings domain.

### X — Certificate staging (2 files) → lib `stageFiles()`

`web/edit/web`, `web/edit/mail`: write `.crt` / `.key` / `.ca` into a temp
dir → the `v-*-domain-ssl` command consumes them → unlink all three.

### B — Backup-exclusions staging (1 file) → `stageFile()`

`web/edit/backup/exclusions`: same pattern, exclusions list edition.

## The tail: panel-owned files and reads

### D — Panel state files (2 files) → port the pattern as-is

- `web/download/backup`: does **not** stream the backup itself. It stats
  `/backup/<file>` directly, enforces ownership (admin, or the filename
  must start with `<user>.`), then answers with `X-Accel-Redirect` so
  Hestia's nginx serves the bytes. If the file is absent it schedules a
  remote-backup download instead. Next equivalent: a route handler doing
  the same stat + prefix check and returning the same header — byte-for-
  byte behaviour, no `v-*` command exists for the check.
- `web/restart/system`: a reboot-dedup token — `touch /var/tmp/hst_reset_<n>`
  before `v-restart-system`, and on the next page load after reboot,
  "token exists ⇒ this load is the browser's auto-reload" → unlink and
  don't restart again. Port directly (the panel process owns this file;
  `/var/tmp` clearing on reboot is part of the mechanism).

### R — Panel data reads (3 files)

- `web/inc/i18n.php`: `web/locale/languages.json` (ships with the panel →
  becomes a build-time import in Next) and the **mail templates** in
  `$HESTIA/data/templates/email/*.html` — operator-customizable data files,
  referenced by no bash code, so the Next panel keeps reading them from
  disk at runtime exactly as PHP does.
- `web/templates/includes/css.php`: theme resolution by `file_exists` on
  theme paths — the D6 parity port does the same checks server-side when
  resolving theme CSS.
- `web/inc/secure_login.php`: if `/usr/local/hestia/web/inc/login_url.php`
  exists, the login path is customized (the "secret login URL" feature).
  Phase 1 auth design input: port as a config-driven login-path setting,
  not a PHP include.

### N — Not filesystem at all (2 files, reclassified)

- `web/list/rrd/ajax.php`: `file_get_contents("php://input")` is the
  request body — in Next this is `request.json()` in a route handler.
- `web/inc/mail-wrapper.php`: `file_get_contents("php://stdin")` — a CLI
  helper the panel's mail sending pipes through (SMTP settings come from
  sys config). It is invoked by installer/func code paths, not the web
  request cycle. Port as a small Node CLI when the mail flows (reset,
  2FA, notifications) are ported in Phase 1/3.

### W — `web/src`: the panel's hidden second layer (10 files with I/O)

`web/src` is 64 files / ~2,965 lines of PHP the first inventory underrated:
a `Hestia\System` layer plus the **quick-install WebApp framework**
(`AppWizard`, `BaseSetup`, `InstallationTarget`, ~20 installer classes:
WordPress-family, Nextcloud, Laravel, Symfony, Drupal, Joomla, …).

- `HestiaApp.php` is `HestiaClient` in embryo: `runUser()` prepends the
  effective user (session user, or `look` when impersonating) and runs
  `v-*` through sudo — with two differences that matter: it shells through
  Symfony Process with a space-escaping hack (the lib's argv-only
  `execFile` is strictly safer), and its timeout is **300s**, because…
- …installers execute **synchronously inside the web request**
  (`AppWizard::execute($_POST)` from `web/add/webapp`). This is the one
  place today's panel breaks the "no long jobs inline" rule. Its own I/O
  is the same staging pattern behind methods like `createFile()` /
  `databaseAdd()`, plus `v-*-fs-*` wrappers for work inside user homes.
- Installer classes with direct I/O (8): Castopod, Dolibarr, Flarum,
  Laravel, Shopware, Symfony (all read a bundled `.htaccess` template) and
  ClassicPress, ConcreteCMS (`glob` the docroot after extraction).
  `web/add/webapp/index.php` discovers installers by globbing the
  `Installers/*/` directory.

**Disposition (Phase 4, the heaviest single chunk):** port the framework
and installers to TypeScript in `@hestiacp/lib` behind a job runner
(queue + status, aligned with the `v-schedule-*` pattern), with a
transitional option: keep a PHP sidecar for installs only, invoked by the
Next panel, until the TS ports land. Also note `HestiaApp::getUserHomeDir`
uses `posix_getpwnam` — Node has no equivalent for arbitrary users; parse
`/etc/passwd` or `getent passwd <user>` in the lib.

## App hand-offs

### File manager (FileGator at `/fm/`) — the hard one

- Served by the panel nginx at `/fm/` when sys config `FILE_MANAGER=true`;
  the top-bar link is gated on that flag.
- `install/deb/filemanager/filegator/configuration.php` is Hestia-patched:
  it `session_start()`s the **PHP session** and reads `$_SESSION` (user,
  `token`, language, combined-IP) — on IP mismatch it calls
  `v-log-user-logout` and destroys the session. It then works as the user
  via an SFTP key it auto-provisions at
  `/home/<user>/.ssh/hst-filemanager-key` (trashed after 30 min).
- **Implication:** FileGator does not have its own login — the PHP session
  _is_ its auth. A Next panel with its own session format silently breaks
  `/fm/` at cutover unless the session layer is bridge-compatible (below).

### Web terminal — same contract, smaller surface

- Panel page `/list/terminal/` embeds xterm; the standalone Node terminal
  server (`src/deb/web-terminal/server.js`) authenticates each connection
  by shelling to a PHP CLI shim (`web-terminal-session-auth.php`) that
  opens the **PHP session file by id** (`session_name("HESTIASID")`,
  save path `$HESTIA/data/sessions`) and returns `{ok, user, look}`.

### The unified implication: PHP session files are a cross-app contract

Both satellite apps read **PHP-serialized session files** named
`sess_<id>` in `/usr/local/hestia/data/sessions`, keyed by the `HESTIASID`
cookie. Decision-grade recommendation for Phase 1 (amends D3's
implementation, not its design):

> The production `SessionStore` writes sessions as PHP-format session
> files at the production path, under the `HESTIASID` cookie name, with
> the keys the satellites read (`user`, `look`, `token`, `language`, …).
> PHP's serialization for flat scalar maps (`key|s:<len>:"value";`) is
> small enough to write and parse safely in the lib. FileGator and the
> terminal then keep working **untouched** through the whole conversion,
> and the spike's JSON store + `HESTIANGSID` cookie stay dev-only.

### phpMyAdmin / phpPgAdmin — trivial

Plain links from the DB list page to `//<host>/phpmyadmin/` and
`/phppgadmin/` (or the `DB_PGA_ALIAS` custom alias), `target=_blank`,
served by the _user_ web stack. **No SSO, no token** — users authenticate
with DB credentials. Phase 3 just reproduces the link construction.

### Webmail (Roundcube / SnappyMail) — trivial

Links from the mail pages to `https://webmail.<mail-domain>/` (or the
`WEBMAIL_ALIAS` host label), a separate vhost on the user web stack; login
is with mail-account credentials, nothing handed off from the panel.

### Shell requirement found by the hand-off trace

Every gate above — `FILE_MANAGER`, `WEB_TERMINAL`, `WEBMAIL_SYSTEM`,
`WEBMAIL_ALIAS`, `DB_PGA_ALIAS`, policies, theme — reaches the PHP panel
because `web/inc/main.php` loads `v-list-sys-config` into `$_SESSION` at
login. **Phase 1 checklist addition:** the Next shell must load sys config
at login into the session/context the same way, or every one of these
toggles silently defaults off.

### One more API contract item (for D4)

`web/api/index.php` does not only dispatch commands: `v-make-tmp-file` is
**implemented in PHP inside the API** (writes `arg1` to
`/tmp/<basename(arg2)>`), because DNS clustering depends on it. The Next
API shim must special-case it identically, in both the legacy and JSON
request paths, or cluster sync breaks.
