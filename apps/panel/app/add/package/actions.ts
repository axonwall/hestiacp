"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";
import { readPackageFields } from "@/app/packages/package-form";

/** Create a package (web/add/package → v-add-user-package, no force flag). */
export async function addPackageAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/add/package?error=csrf");
	}
	const name = String(formData.get("name") ?? "").trim();
	if (!name) {
		redirect("/add/package?error=missing");
	}
	try {
		await hestia.addUserPackage(name, readPackageFields(formData), false);
	} catch (error) {
		redirect(`/add/package?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/packages/${encodeURIComponent(name)}`);
}
