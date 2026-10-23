import { HestiaClient, loadConfig, SessionStore, type PanelSession } from "@hestiacp/lib";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * App-local wiring of @hestiacp/lib singletons. Everything in the panel
 * reaches Hestia through this module — no other file constructs a client.
 */
const config = loadConfig();

export const hestia = new HestiaClient(config);
export const sessions = new SessionStore(config);

export const SESSION_COOKIE = "HESTIANGSID";

export async function getSession(): Promise<PanelSession | null> {
	const jar = await cookies();
	const id = await sessions.idFromCookie(jar.get(SESSION_COOKIE)?.value);
	if (!id) return null;
	return sessions.get(id);
}

/** For pages/actions that require a login: bounce to /login when absent. */
export async function requireSession(): Promise<PanelSession> {
	const session = await getSession();
	if (!session) {
		redirect("/login");
	}
	return session;
}

/**
 * Spike simplification, flagged for Phase 1: the root user is taken from
 * HESTIANG_ROOT_USER (default "admin"). The real panel derives the admin
 * context from v-list-sys-config's ROOT_USER and the account record.
 */
export function userContextFor(user: string): PanelSession["userContext"] {
	return user === (process.env.HESTIANG_ROOT_USER ?? "admin")
		? "admin"
		: "user";
}
