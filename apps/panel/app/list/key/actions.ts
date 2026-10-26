"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete one SSH key from the list (PHP /delete/key/). */
export async function deleteSshKeyAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/key?error=csrf");
	try {
		await hestia.deleteUserSshKey(effectiveUser(session), String(formData.get("key") ?? ""));
	} catch (error) {
		redirect(`/list/key?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/key?saved=1");
}
