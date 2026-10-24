"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

export async function deleteBackupAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const backup = String(formData.get("backup") ?? "");
	const back = `/delete/backup?backup=${encodeURIComponent(backup)}`;
	if (!csrfValid(session, formData) || !backup) redirect("/list/backup?error=csrf");
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteUserBackup(user, backup);
	} catch (error) {
		redirect(`/list/backup?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/backup?saved=1");
}
