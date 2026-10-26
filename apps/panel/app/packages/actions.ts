"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/** Bulk package action (PHP /bulk/package/): delete only. */
export async function bulkPackagesAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/packages?error=csrf");
	}
	const op = String(formData.get("action") ?? "");
	const packages = formData.getAll("package[]").map(String).filter(Boolean);
	try {
		for (const name of packages) {
			if (op === "delete") await hestia.deleteUserPackage(name);
		}
	} catch (error) {
		redirect(`/packages?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/packages?saved=1");
}

/** Duplicate a package (PHP /copy/package/): PACKAGE becomes PACKAGE-copy. */
export async function copyPackageAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/packages?error=csrf");
	}
	const name = String(formData.get("package") ?? "");
	try {
		if (name) await hestia.copyUserPackage(name);
	} catch (error) {
		redirect(`/packages?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/packages?saved=1");
}
