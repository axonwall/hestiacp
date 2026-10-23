import {
	HestiaClient,
	loadConfig,
	PhpSessionStore,
	type PhpSessionData,
} from "@hestiacp/lib";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * App-local wiring of @hestiacp/lib singletons. Everything in the panel
 * reaches Hestia through this module — no other file constructs a client.
 *
 * Phase 1 shell: sessions are PHP-format session files (PhpSessionStore)
 * under the production HESTIASID cookie name, so FileGator (/fm/) and the
 * web terminal's auth shim — both of which read PHP sessions — keep
 * working untouched. See apps/panel/docs/phase0-audit.md.
 */
const config = loadConfig();

export const hestia = new HestiaClient(config);
export const sessions = new PhpSessionStore(config);

export const SESSION_COOKIE = "HESTIASID";

export interface ShellSession {
	id: string;
	data: PhpSessionData;
}

export async function getSession(): Promise<ShellSession | null> {
	const jar = await cookies();
	const id = jar.get(SESSION_COOKIE)?.value;
	if (!id) return null;
	try {
		const data = await sessions.get(id);
		return data ? { id, data } : null;
	} catch {
		return null;
	}
}

/**
 * For pages/actions that require a login. Mirrors web/inc/main.php's
 * per-request discipline:
 *  - no user / no sys config in session → bounce to /login
 *  - the account record is re-read every request: a deleted user, an
 *    admin whose ROLE was revoked, or a suspended user (unless the
 *    view-suspended policy allows it) destroys the session
 *  - sys config is refreshed into the session (load_hestia_config),
 *    and login_shell / role are updated from the account record
 */
export async function requireSession(): Promise<ShellSession> {
	const session = await getSession();
	if (!session?.data.user || !session.data.VERSION) {
		redirect("/login");
	}

	let userRecord;
	try {
		userRecord = await hestia.listUser(String(session.data.user));
	} catch {
		await sessions.destroy(session.id);
		redirect("/login");
	}
	if (session.data.userContext === "admin" && userRecord.ROLE !== "admin") {
		await sessions.destroy(session.id);
		redirect("/login");
	}
	if (
		userRecord.SUSPENDED === "yes" &&
		session.data.POLICY_USER_VIEW_SUSPENDED !== "yes"
	) {
		await sessions.destroy(session.id);
		redirect("/login");
	}

	const sys = await hestia.listSysConfig().catch(() => null);
	if (sys?.config) {
		Object.assign(session.data, sys.config);
	}
	session.data.login_shell = userRecord.SHELL ?? "";
	session.data.role = userRecord.ROLE ?? "";
	await sessions.set(session.id, session.data);
	return session;
}

/** requireSession + the caller must be an admin (user-admin pages). */
export async function requireAdmin(): Promise<ShellSession> {
	const session = await requireSession();
	if (session.data.userContext !== "admin") {
		redirect("/users");
	}
	return session;
}

/** First line of an error's message, truncated — for ?error= redirects. */
export function errorMessage(error: unknown): string {
	const raw = error instanceof Error ? error.message : String(error);
	return raw.split("\n")[0].slice(0, 200);
}

/** CSRF token generation, as main.php does: bin2hex(random_bytes(16)). */
export function newCsrfToken(): string {
	return randomBytes(16).toString("hex");
}

/** Verify a mutating form's token against the session token (prevent_csrf.php). */
export function csrfValid(session: ShellSession, formData: FormData): boolean {
	const token = formData.get("token");
	return (
		typeof token === "string" &&
		token.length > 0 &&
		token === session.data.token
	);
}
