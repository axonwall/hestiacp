"use server";

import { redirect } from "next/navigation";
import type { AccessKeyRecord } from "@hestiacp/lib";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
	sessions,
} from "@/lib/panel";

/**
 * PHP /add/access-key/ gate: API_SYSTEM below 1 (or below 2 for
 * non-admins) redirects to /edit/user/. userContext admin is the
 * Next proxy for PHP's ROOT_USER comparison.
 */
type Session = Awaited<ReturnType<typeof requireSession>>;

function apiStatus(session: Session): number {
	const raw = session.data.API_SYSTEM;
	const n = typeof raw === "string" || typeof raw === "number" ? Number(raw) : Number.NaN;
	return Number.isNaN(n) ? 0 : n;
}

function gate(session: Session): boolean {
	const status = apiStatus(session);
	if (status < 1) return false;
	if (session.data.userContext !== "admin" && status < 2) return false;
	return true;
}

/** Create an access key, stash its secret once, show the detail view. */
export async function addAccessKeyAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!gate(session)) {
		redirect("/edit/user");
	}
	if (!csrfValid(session, formData)) {
		redirect("/add/access-key?error=csrf");
	}
	const user = effectiveUser(session);
	const selected = formData.getAll("v_apis[]").map(String).filter(Boolean);
	const comment = String(formData.get("v_comment") ?? "").trim();
	const apis = await hestia.listApis();
	const allowed = Object.keys(apis).filter(
		(api) => session.data.userContext === "admin" || apis[api]?.ROLE === "user",
	);
	if (selected.length === 0) {
		redirect(`/add/access-key?error=${encodeURIComponent("Permissions")}`);
	}
	if (selected.some((api) => !allowed.includes(api))) {
		redirect(`/add/access-key?error=${encodeURIComponent("API not allowed")}`);
	}
	let record: AccessKeyRecord;
	try {
		record = await hestia.addAccessKey(user, selected.join(","), comment);
	} catch (error) {
		redirect(`/add/access-key?error=${encodeURIComponent(errorMessage(error))}`);
	}
	try {
		session.data.hestiang_new_access_key = JSON.stringify({
			id: record.ACCESS_KEY_ID,
			secret: record.SECRET_ACCESS_KEY,
		});
		await sessions.set(session.id, session.data);
	} catch {
		// The key exists; without the stash the detail page just hides
		// the secret, as a plain detail visit does.
		redirect(`/list/access-key/${encodeURIComponent(record.ACCESS_KEY_ID)}`);
	}
	redirect(`/list/access-key/${encodeURIComponent(record.ACCESS_KEY_ID)}?created=1`);
}
