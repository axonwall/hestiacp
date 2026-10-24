"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Delete delete database (web/delete/db) after the confirm page's checkbox. */
export async function deleteDatabaseAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const database = String(formData.get("database") ?? "");
	const back = `/delete/db?database=${encodeURIComponent(database)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteDatabase(user, database);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/db");
}
