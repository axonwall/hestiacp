"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

export async function scheduleResticBackupAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	await hestia.scheduleUserBackupRestic(effectiveUser(session));
	redirect("/list/backup/restic?notice=scheduled");
}

/** Bulk restic action (PHP /bulk/backup/incremental/): delete only. */
export async function bulkResticAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	const user = effectiveUser(session);
	const snapshots = formData.getAll("backup[]").map(String).filter(Boolean);
	try {
		for (const snapshot of snapshots) {
			await hestia.deleteUserBackupRestic(user, snapshot);
		}
	} catch (error) {
		redirect(`/list/backup/restic?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/backup/restic?notice=deleted");
}
