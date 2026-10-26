"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Create a database (web/add/db). Database and user are SUFFIXES —
 *  v-add-database prefixes them with "<user>_" itself. */
export async function addDatabaseAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/db?error=csrf");
	const user = effectiveUser(session);
	const database = String(formData.get("database") ?? "")
		.trim()
		.toLowerCase();
	const dbuser = String(formData.get("dbuser") ?? "")
		.trim()
		.toLowerCase();
	const secret = String(formData.get("secret") ?? "");
	if (!database || !dbuser || !secret) redirect("/add/db?error=missing");
	try {
		await hestia.addDatabase(
			user,
			database,
			dbuser,
			secret,
			String(formData.get("type") ?? "mysql"),
			String(formData.get("host") ?? "localhost"),
			String(formData.get("charset") ?? "utf8mb4"),
		);
	} catch (error) {
		redirect(`/add/db?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/db?saved=1");
}
