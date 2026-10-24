"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

export async function saveBackupExclusionsAction(
	formData: FormData,
): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/edit/backup/exclusions?error=csrf");
	const user = effectiveUser(session);
	const clean = (v: FormDataEntryValue | null) =>
		String(v ?? "")
			.split(/[,\n]/)
			.map((s) => s.trim())
			.filter(Boolean)
			.join(",");
	try {
		await hestia.updateUserBackupExclusions(user, {
			WEB: clean(formData.get("WEB")),
			DNS: clean(formData.get("DNS")),
			MAIL: clean(formData.get("MAIL")),
			DB: clean(formData.get("DB")),
			USER: clean(formData.get("USER")),
		});
	} catch (error) {
		redirect(
			`/edit/backup/exclusions?error=${encodeURIComponent(errorMessage(error))}`,
		);
	}
	redirect("/edit/backup/exclusions?saved=1");
}

export async function deleteBackupExclusionsAction(
	formData: FormData,
): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/edit/backup/exclusions?error=csrf");
	const user = effectiveUser(session);
	try {
		await hestia.deleteUserBackupExclusions(
			user,
			String(formData.get("system") ?? ""),
		);
	} catch (error) {
		redirect(
			`/edit/backup/exclusions?error=${encodeURIComponent(errorMessage(error))}`,
		);
	}
	redirect("/edit/backup/exclusions?saved=1");
}
