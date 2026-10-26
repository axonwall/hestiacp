"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

function backTo(formData: FormData, notice?: string): string {
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	const folder = formData.get("folder")?.toString() ?? "";
	const base = `/list/backup/restic/browse?snapshot=${encodeURIComponent(snapshot)}&folder=${encodeURIComponent(folder)}`;
	return notice ? `${base}&notice=${notice}` : base;
}

/** Per-entry restore (schedule/restore/incremental, type=file). */
export async function restoreResticFileAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	const path = formData.get("path")?.toString() ?? "";
	try {
		await hestia.scheduleUserRestoreRestic(effectiveUser(session), snapshot, "file", path);
	} catch (error) {
		redirect(`${backTo(formData)}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(backTo(formData, "scheduled"));
}

/** Bulk restore of the checked entries, one schedule call per path. */
export async function restoreResticSelectedAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	const files = formData.getAll("files").map((v) => v.toString());
	const user = effectiveUser(session);
	try {
		for (const path of files) {
			await hestia.scheduleUserRestoreRestic(user, snapshot, "file", path);
		}
	} catch (error) {
		redirect(`${backTo(formData)}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(backTo(formData, "scheduled"));
}
