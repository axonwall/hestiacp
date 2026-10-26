"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, hestia, requireSession } from "@/lib/panel";

export async function deleteResticAction(formData: FormData) {
	const session = await requireSession();
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	if (formData.get("confirm") !== "yes") {
		redirect(`/delete/backup/restic?snapshot=${encodeURIComponent(snapshot)}&error=confirm`);
	}
	await hestia.deleteUserBackupRestic(effectiveUser(session), snapshot);
	redirect("/list/backup/restic?notice=deleted");
}
