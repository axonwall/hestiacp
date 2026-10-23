"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/**
 * Delete a user (web/delete/user → v-delete-user). Guards: the caller must
 * confirm explicitly, and neither the caller's own account nor the
 * ROOT_USER can be deleted from here.
 */
export async function deleteUserAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const user = String(formData.get("user") ?? "");
	const back = `/users/${encodeURIComponent(user)}/delete`;
	if (!csrfValid(session, formData) || !user) {
		redirect(`${back}?error=csrf`);
	}
	if (formData.get("confirm") !== "yes") {
		redirect(`${back}?error=confirm`);
	}
	if (user === session.data.user || user === session.data.ROOT_USER) {
		redirect(`${back}?error=protected`);
	}
	try {
		await hestia.deleteUser(user);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/users");
}
