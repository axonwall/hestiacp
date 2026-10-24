import {
	HestiaClient,
	loadConfig,
	PhpSessionStore,
	type HestiaRow,
	type HestiaUser,
	type PhpSessionData,
} from "@hestiacp/lib";
import { randomBytes } from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getTranslator, type Translator } from "./i18n";

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
 * The client IP for session binding. PHP's get_real_user_ip() reads
 * REMOTE_ADDR, which Hestia's nginx sets to the real client when it
 * proxies to the panel; the Next standalone server sees nginx as its
 * peer, so the equivalent carrier is the first X-Forwarded-For entry
 * nginx set. Falls back to 127.0.0.1 for direct/local access.
 */
export function clientIp(h: Headers): string {
	return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "127.0.0.1";
}

/**
 * Build a full session record for a freshly authenticated user, exactly
 * as the login flow in web/login + load_hestia_config assemble it: every
 * sys-config key merged in, userContext from the account's ROLE, a fresh
 * CSRF token, language, the combined login IP, LAST_ACTIVITY, shell/role.
 */
export async function buildFullSessionData(
	user: string,
	ip: string,
): Promise<{ data: PhpSessionData; record: HestiaUser }> {
	const record = await hestia.listUser(user);
	const sys = await hestia.listSysConfig();
	const data: PhpSessionData = {
		...(sys.config ?? {}),
		user,
		userContext: record.ROLE === "admin" ? "admin" : "user",
		look: "",
		token: newCsrfToken(),
		language: record.LANGUAGE ?? "en",
		user_combined_ip: ip,
		LAST_ACTIVITY: Math.floor(Date.now() / 1000),
		login_shell: record.SHELL ?? "",
		role: record.ROLE ?? "",
	};
	return { data, record };
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

	// IP binding (main.php): the session is tied to the IP it was created
	// from. A mismatch destroys the session and logs the logout — unless
	// the sys config disables the check. A missing value is adopted, as
	// main.php adopts it.
	const ip = clientIp(await headers());
	if (!session.data.user_combined_ip) {
		session.data.user_combined_ip = ip;
	} else if (
		session.data.DISABLE_IP_CHECK !== "yes" &&
		session.data.user_combined_ip !== ip
	) {
		await hestia.logUserLogout(
			String(session.data.user),
			String(session.data.token ?? ""),
		);
		await sessions.destroy(session.id);
		redirect("/login");
	}

	const sys = await hestia.listSysConfig().catch(() => null);
	if (sys?.config) {
		Object.assign(session.data, sys.config);
	}
	session.data.login_shell = userRecord.SHELL ?? "";
	session.data.role = userRecord.ROLE ?? "";
	// The account's theme (main.php's userTheme) drives the theme
	// stylesheet selection in the root layout.
	session.data.userTheme = userRecord.THEME ?? "";
	// The panel language tracks the account record (a language change in
	// the edit form takes effect on the next request, as in PHP).
	session.data.language = userRecord.LANGUAGE ?? "en";

	// Impersonation: while `look` is set, the shell/role presented are the
	// looked user's (main.php). A deleted look target clears the look.
	const look = String(session.data.look ?? "");
	if (look) {
		const lookRecord = await hestia.listUser(look).catch(() => null);
		if (!lookRecord) {
			session.data.look = "";
		} else {
			session.data.login_shell = lookRecord.SHELL ?? "";
			session.data.role = lookRecord.ROLE ?? "";
		}
	}
	await sessions.set(session.id, session.data);
	return session;
}

/** The account the panel is acting for: the impersonation target while
 *  `look` is set, otherwise the session's own user (as in PHP). */
export function effectiveUser(session: ShellSession): string {
	return String(session.data.look || session.data.user || "");
}

/** Run a list fetch, converting failures into a renderable error. */
export async function loadRows(
	fn: () => Promise<Record<string, HestiaRow>>,
): Promise<{ rows: Record<string, HestiaRow> } | { error: string }> {
	try {
		return { rows: await fn() };
	} catch (error) {
		return {
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

/** Translator bound to the current session's language (i18n pipeline). */
export async function getT(): Promise<Translator> {
	const session = await getSession();
	return getTranslator(String(session?.data.language ?? "en"));
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
