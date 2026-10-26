"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete the viewed log (PHP /delete/log/). */
export async function deleteLogAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/log?error=csrf");
	const user = String(formData.get("user") ?? "") || effectiveUser(session);
	try {
		await hestia.deleteUserLog(user);
	} catch (error) {
		redirect(`/list/log?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/log?saved=1");
}
