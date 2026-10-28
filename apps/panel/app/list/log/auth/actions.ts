"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete the viewed auth log (PHP /delete/log/auth/). */
export async function deleteAuthLogAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/log/auth?error=csrf");
	const user = String(formData.get("user") ?? "") || effectiveUser(session);
	const back = String(formData.get("back") ?? "/list/log/auth");
	try {
		await hestia.deleteUserAuthLog(user);
	} catch (error) {
		redirect(`/list/log/auth?error=${encodeURIComponent(errorMessage(error))}`);
	}
	const sep = back.includes("?") ? "&" : "?";
	redirect(`${back}${sep}saved=1`);
}
