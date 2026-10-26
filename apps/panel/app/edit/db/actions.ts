"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Edit a database (web/edit/db): user change + optional new password.
 *  Both take suffixes — the commands prefix "<user>_" themselves. */
export async function editDatabaseAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const database = String(formData.get("database") ?? "");
	const back = `/edit/db?database=${encodeURIComponent(database)}`;
	if (!csrfValid(session, formData) || !database) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	try {
		const current = await hestia.listDatabase(user, database);
		const suffix = (full: string) =>
			full.startsWith(`${user}_`) ? full.slice(user.length + 1) : full;
		const dbuser = String(formData.get("dbuser") ?? "")
			.trim()
			.toLowerCase();
		if (dbuser && dbuser !== suffix(current.DBUSER ?? "")) {
			await hestia.changeDatabaseUser(user, database, dbuser);
		}
		const secret = String(formData.get("secret") ?? "");
		if (secret) {
			await hestia.changeDatabasePassword(user, database, secret);
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
