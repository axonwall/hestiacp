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

## Remaining limitations (deliberate, later phases)

- No 2FA, no login-as impersonation yet (Phase 1 follow-ups).
- IP binding recorded (`user_combined_ip`) but not yet enforced like
  main.php's check.
- Visuals are placeholder-minimal: D6 is parity-first, and the theme port
  is Phase 2 work.
