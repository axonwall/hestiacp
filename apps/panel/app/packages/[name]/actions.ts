"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";
import { readPackageFields } from "../package-form";

/** Save a package edit — v-add-user-package with the force flag (web/edit/package). */
export async function editPackageAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const name = String(formData.get("name") ?? "");
	const back = `/packages/${encodeURIComponent(name)}`;
	if (!csrfValid(session, formData) || !name) {
		redirect(`${back}?error=csrf`);
	}
	try {
		await hestia.addUserPackage(name, readPackageFields(formData), true);
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}?saved=1`);
}
