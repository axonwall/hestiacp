"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/** Suspend / unsuspend from the users list (v-suspend-user / v-unsuspend-user). */
export async function toggleSuspendAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const user = String(formData.get("user") ?? "");
	const op = String(formData.get("op") ?? "");
	if (!csrfValid(session, formData) || !user) {
		redirect("/users?error=csrf");
	}
	try {
		if (op === "suspend") {
			await hestia.suspendUser(user);
		} else {
			await hestia.unsuspendUser(user);
		}
	} catch (error) {
		redirect(`/users?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/users");
}
