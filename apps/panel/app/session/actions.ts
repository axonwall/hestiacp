"use server";

import { redirect } from "next/navigation";
import { csrfValid, hestia, requireAdmin, requireSession, sessions } from "@/lib/panel";

/**
 * Login-as (impersonation), mirroring web/login's loginas handling:
 * admin-only, CSRF-checked, the target must exist, and both audit lines
 * are written via v-log-action with PHP's exact messages. The session's
 * `user` stays the admin; `look` carries the impersonated account.
 * PHP exposes this as a GET link; a POST action is used here — same
 * checks, no token in the URL.
 */
export async function loginAsAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const target = String(formData.get("user") ?? "");
	if (!csrfValid(session, formData) || !target) {
		redirect("/users?error=csrf");
	}
	if (target === session.data.user) {
		redirect("/users");
	}
	const record = await hestia.listUser(target).catch(() => null);
	if (!record) {
		redirect("/users?error=nosuchuser");
	}
	const admin = String(session.data.user);
	session.data.look = target;
	await sessions.set(session.id, session.data);
	await hestia.logAction(admin, "Info", "Security", `Logged in as another user (User: ${target})`);
	await hestia.logAction(
		"system",
		"Warning",
		"Security",
		`User impersonation session started (User: ${target}, Administrator: ${admin})`,
	);
	redirect(`/users/${encodeURIComponent(target)}`);
}

/** End impersonation: clear `look` and go back to the admin's user list. */
export async function returnToAdminAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) {
		redirect("/users?error=csrf");
	}
	session.data.look = "";
	await sessions.set(session.id, session.data);
	redirect("/users");
}
