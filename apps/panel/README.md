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

## Spike limitations (deliberate, Phase 1 work)

- No 2FA, no login-as impersonation, no CSRF token beyond Next's server
  action origin checks.
- The login IP is recorded in the session but binding is not enforced yet.
- Admin context is `user === HESTIANG_ROOT_USER` (default `admin`); the real
  derivation comes from `v-list-sys-config` + the account record.
- Visuals are placeholder-minimal: D6 is parity-first, and the theme port is
  Phase 2 work, not spike work.
