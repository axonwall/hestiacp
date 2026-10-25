"use server";

import { redirect } from "next/navigation";
import type { HestiaUser } from "@hestiacp/lib";
import {
	csrfValid,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/**
 * Full user edit (web/edit/user). Mirrors the PHP discipline: one command
 * per field, and only for fields whose value actually changed — gratuitous
 * calls would restart services and pollute the action log. The first
 * failure stops the sequence and surfaces the command's error, as
 * check_return_code does. Password changes only when a new one is given.
 *
 * Admins may edit anyone; non-admins only themselves, and the admin-only
 * fields (package, shell, role) are ignored for them.
 */
export async function editUserAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const user = String(formData.get("user") ?? "");
	const back = `/users/${encodeURIComponent(user)}`;
	if (!csrfValid(session, formData) || !user) {
		redirect(`${back}?error=csrf`);
	}
	// While impersonating, the admin acts AS the looked user: admin-only
	// fields are gated off, and only the looked account is editable.
	const look = String(session.data.look ?? "");
	const isAdmin = session.data.userContext === "admin" && !look;
	const selfTarget = session.data.user === user || look === user;
	if (!isAdmin && !selfTarget) {
		redirect("/users");
	}

	let record: HestiaUser;
	try {
		record = await hestia.listUser(user);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}

	const get = (name: string) => String(formData.get(name) ?? "").trim();
	const steps: Array<() => Promise<void>> = [];

	const fullName = [get("firstName"), get("lastName")]
		.filter(Boolean)
		.join(" ");
	if (fullName && fullName !== record.NAME) {
		steps.push(() =>
			hestia.changeUserName(user, get("firstName"), get("lastName") || undefined),
		);
	}
	const email = get("email");
	if (email && email !== (record.CONTACT ?? "")) {
		steps.push(() => hestia.changeUserContact(user, email));
	}
	const secret = String(formData.get("secret") ?? "");
	if (secret) {
		steps.push(() => hestia.changeUserPassword(user, secret));
	}
	if (isAdmin) {
		const pkg = get("package");
		if (pkg && pkg !== record.PACKAGE) {
			steps.push(() => hestia.changeUserPackage(user, pkg));
		}
		const shell = get("shell");
		const currentShell = (record.SHELL ?? "").split("/").pop() ?? "";
		if (shell && shell !== currentShell) {
			steps.push(() => hestia.changeUserShell(user, shell));
		}
		const role = get("role");
		if (role && role !== record.ROLE) {
			steps.push(() => hestia.changeUserRole(user, role));
		}
	}
	const language = get("language");
	if (language && language !== record.LANGUAGE) {
		steps.push(() => hestia.changeUserLanguage(user, language));
	}
	const theme = get("theme");
	if (theme && theme !== (record.THEME ?? "")) {
		steps.push(() => hestia.changeUserTheme(user, theme));
	}
	const ns = get("ns")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (ns.length > 0 && ns.join(",") !== (record.NS ?? "")) {
		steps.push(() => hestia.changeUserNs(user, ns));
	}
	const loginDisabled = formData.get("loginDisabled") === "yes" ? "yes" : "no";
	if (loginDisabled !== (record.LOGIN_DISABLED ?? "no")) {
		steps.push(() =>
			hestia.changeUserConfigValue(user, "LOGIN_DISABLED", loginDisabled),
		);
	}

	try {
		for (const step of steps) {
			await step();
		}
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}?saved=1`);
}

/** Who may manage an account's 2FA: an un-impersonating admin, or the
 *  account owner (directly, or as the impersonation target). */
function canManage2fa(
	session: { data: { userContext?: unknown; user?: unknown; look?: unknown } },
	user: string,
): boolean {
	const look = String(session.data.look ?? "");
	return (
		(session.data.userContext === "admin" && !look) ||
		session.data.user === user ||
		look === user
	);
}

/** Enable 2FA (v-add-user-2fa generates + stores the secret server-side;
 *  it appears in the account record — and in the section below — after). */
export async function enable2faAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const user = String(formData.get("user") ?? "");
	const back = `/users/${encodeURIComponent(user)}`;
	if (!csrfValid(session, formData) || !user || !canManage2fa(session, user)) {
		redirect(`${back}?error=csrf`);
	}
	try {
		await hestia.addUser2fa(user);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}?saved=1`);
}

/** Disable 2FA (v-delete-user-2fa). */
export async function disable2faAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const user = String(formData.get("user") ?? "");
	const back = `/users/${encodeURIComponent(user)}`;
	if (!csrfValid(session, formData) || !user || !canManage2fa(session, user)) {
		redirect(`${back}?error=csrf`);
	}
	try {
		await hestia.deleteUser2fa(user);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}?saved=1`);
}
