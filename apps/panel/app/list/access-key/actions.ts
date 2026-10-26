"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete one access key from the list (PHP /delete/access-key/). */
export async function deleteAccessKeyAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/access-key?error=csrf");
	try {
		await hestia.deleteAccessKey(String(formData.get("key") ?? ""));
	} catch (error) {
		redirect(`/list/access-key?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/access-key?saved=1");
}

/** Bulk access-key action (PHP /bulk/access-key/): delete only. */
export async function bulkAccessKeyAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/access-key?error=csrf");
	const keys = formData.getAll("key[]").map(String).filter(Boolean);
	try {
		for (const key of keys) await hestia.deleteAccessKey(key);
	} catch (error) {
		redirect(`/list/access-key?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/access-key?saved=1");
}
