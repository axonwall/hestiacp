"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/**
 * Create a user (web/add/user): the lib stages the secret for v-add-user,
 * then applies language / role / login-disabled through their own commands.
 */
export async function addUserAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/add/user?error=csrf");
	}
	const user = String(formData.get("user") ?? "").trim();
	const secret = String(formData.get("secret") ?? "");
	const email = String(formData.get("email") ?? "").trim();
	const pkg = String(formData.get("package") ?? "default");
	const name = String(formData.get("name") ?? "").trim();
	const language = String(formData.get("language") ?? "");
	const role = String(formData.get("role") ?? "user");
	const loginDisabled = formData.get("loginDisabled") === "yes";
	if (!user || !secret || !email || !name) {
		redirect("/add/user?error=missing");
	}
	try {
		await hestia.addUser({
			user,
			secret,
			email,
			package: pkg,
			name,
			language: language || undefined,
			role,
			loginDisabled,
		});
	} catch (error) {
		redirect(`/add/user?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/users/${encodeURIComponent(user)}`);
}
