import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Runtime configuration for talking to a HestiaCP install.
 *
 * Production defaults mirror the PHP panel exactly:
 *  - commands live in /usr/local/hestia/bin
 *  - they are invoked through sudo (the hestiaweb sudoers rule allows only that path)
 *
 * Dev/test can point HESTIA_BIN at any directory of v-* scripts (e.g. the
 * fixtures in test/fixtures/bin) and set HESTIA_USE_SUDO=0.
 */
export interface HestiaConfig {
	binDir: string;
	useSudo: boolean;
	sessionDir: string;
	/** Inactivity timeout for panel sessions, in seconds. */
	sessionTimeoutSeconds: number;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): HestiaConfig {
	const binDir = env.HESTIA_BIN ?? "/usr/local/hestia/bin";
	const useSudo =
		env.HESTIA_USE_SUDO !== undefined
			? env.HESTIA_USE_SUDO === "1"
			: binDir === "/usr/local/hestia/bin";
	return {
		binDir,
		useSudo,
		sessionDir: env.HESTIA_SESSION_DIR ?? join(tmpdir(), "hestiang-sessions"),
		sessionTimeoutSeconds: Number(env.HESTIA_SESSION_TIMEOUT ?? 1800),
	};
}
