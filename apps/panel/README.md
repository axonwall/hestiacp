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

## Remaining limitations (deliberate, later phases)

- Package template fields are text inputs, not the PHP form's
  template-select dropdowns.
- Visuals are placeholder-minimal: D6 is parity-first, and the theme port
  is Phase 2 work.
- `test/api.bats` against a real install still needs D10 (a throwaway
  Hestia 1.10.5 box); everything is fixture-verified until then.
