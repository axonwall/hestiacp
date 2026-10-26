"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/** Delete a package (v-delete-user-package). The command itself refuses
 *  when the package is still assigned to users; its error is surfaced. */
export async function deletePackageAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const name = String(formData.get("name") ?? "");
	const back = `/packages/${encodeURIComponent(name)}/delete`;
	if (!csrfValid(session, formData) || !name) {
		redirect(`${back}?error=csrf`);
	}
	if (formData.get("confirm") !== "yes") {
		redirect(`${back}?error=confirm`);
	}
	try {
		await hestia.deleteUserPackage(name);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/packages");
}
