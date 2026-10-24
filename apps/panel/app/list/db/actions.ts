"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Suspend/unsuspend a database from the list, mirroring the PHP bulk endpoints. */
export async function toggleDatabaseAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/db?error=csrf");
	const user = effectiveUser(session);
	const database = String(formData.get("database") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendDatabase(user, database);
		} else {
			await hestia.unsuspendDatabase(user, database);
		}
	} catch (error) {
		redirect(`/list/db?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/db?saved=1");
}
