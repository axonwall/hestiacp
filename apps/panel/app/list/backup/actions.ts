"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Schedule a backup of the effective user's account (v-schedule-user-backup). */
export async function scheduleBackupAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup?error=csrf");
	const user = effectiveUser(session);
	try {
		await hestia.scheduleUserBackup(user);
	} catch (error) {
		redirect(`/list/backup?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/backup?saved=1");
}
