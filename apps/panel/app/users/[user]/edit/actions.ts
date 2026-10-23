"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { csrfValid, hestia, requireSession } from "@/lib/panel";

/**
 * The spike's one edit action: rename a user via v-change-user-name.
 * Requires a valid session and the session's CSRF token (Phase 1);
 * the lib re-validates the username before the command layer is invoked.
 */
export async function editNameAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const user = String(formData.get("user") ?? "");
	if (!csrfValid(session, formData)) {
		redirect(`/users/${encodeURIComponent(user)}?error=csrf`);
	}
	const firstName = String(formData.get("firstName") ?? "").trim();
	const lastName = String(formData.get("lastName") ?? "").trim();
	if (!user || !firstName) {
		redirect(`/users/${encodeURIComponent(user)}?error=1`);
	}
	await hestia.changeUserName(user, firstName, lastName || undefined);
	revalidatePath(`/users/${encodeURIComponent(user)}`);
	revalidatePath("/users");
	redirect(`/users/${encodeURIComponent(user)}?saved=1`);
}
