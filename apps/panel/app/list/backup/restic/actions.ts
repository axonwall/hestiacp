"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, hestia, requireSession } from "@/lib/panel";

export async function scheduleResticBackupAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	await hestia.scheduleUserBackupRestic(effectiveUser(session));
	redirect("/list/backup/restic?notice=scheduled");
}
