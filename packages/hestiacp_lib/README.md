# @hestiacp/lib — HestiaNG shared library

The shared code for the HestiaCP (Next.js panel) conversion. Everything the
panel knows about talking to a HestiaCP install lives here, so the app in
`apps/panel` stays a thin UI over this API.

## What's here

- **`HestiaClient`** (`src/client.ts`) — typed wrappers over the `v-*`
  command layer: `listUsers`, `listUser`, `listSysConfig`,
  `verifyUserPassword`, `changeUserName`. The client never reads or writes
  Hestia's `.conf` files; the bash layer owns state, exactly as with the PHP
  panel.
- **`runHestiaCommand`** (`src/exec.ts`) — the single choke point for command
  execution: `execFile` with an argv array (no shell, ever), the command name
  validated against the `v-*` pattern, and optional `sudo` prefix matching
  the existing `hestiaweb` sudoers rule.
- **`verifyUserPassword`** follows the PHP panel's own pattern for yescrypt:
  the secret goes into a 0600 temp file under `/tmp` and the *path* is passed
  to `v-check-user-password` — the secret never appears in argv.
- **`SessionStore`** (`src/session.ts`) — server-side sessions per decision
  D3: one JSON file per session (0600), signed-cookie ids, inactivity
  timeout, instant revocation. No JWTs.

## Configuration (environment)

| Variable | Default | Meaning |
|---|---|---|
| `HESTIA_BIN` | `/usr/local/hestia/bin` | Directory containing the `v-*` commands |
| `HESTIA_USE_SUDO` | `1` iff `HESTIA_BIN` is the production path | Prefix commands with `sudo` |
| `HESTIA_SESSION_DIR` | `$TMPDIR/hestiang-sessions` | Session file storage |
| `HESTIA_SESSION_TIMEOUT` | `1800` | Inactivity timeout, seconds |

## Tests

`pnpm --filter @hestiacp/lib test` runs vitest against fixture `v-*` scripts
in `test/fixtures/bin` — canned JSON in, call-log out — so the client is
verified without a Hestia install. Fixtures are test doubles, not Hestia.
