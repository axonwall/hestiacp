"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/**
 * Schedule a restore (web/schedule/restore): full, or one section with
 * a chosen object. Cron restores as a whole (yes), user dirs by name.
 */
export async function restoreBackupAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const backup = String(formData.get("backup") ?? "");
	const back = `/edit/backup/restore?backup=${encodeURIComponent(backup)}`;
	if (!csrfValid(session, formData) || !backup) redirect("/list/backup?error=csrf");
	const user = effectiveUser(session);
	const scope = String(formData.get("scope") ?? "full");
	try {
		if (scope === "full") {
			await hestia.scheduleUserRestore(user, backup);
		} else {
			const sections = {
				web: "no",
				dns: "no",
				mail: "no",
				db: "no",
				cron: "no",
				udir: "no",
			};
			if (scope === "cron") {
				sections.cron = "yes";
			} else {
				const object = String(formData.get("object") ?? "");
				if (!object) redirect(`${back}&error=missing`);
				sections[scope as "web" | "dns" | "mail" | "db" | "udir"] = object;
			}
			await hestia.scheduleUserRestore(user, backup, sections);
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/backup?saved=1");
}
