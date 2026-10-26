"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/** Toggle Hestia automatic updates (PHP /add|delete/cron/autoupdate/). */
export async function toggleAutoupdateAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/updates?error=csrf");
	try {
		if (formData.get("op") === "enable") await hestia.addCronHestiaAutoupdate();
		else await hestia.deleteCronHestiaAutoupdate();
	} catch (error) {
		redirect(`/list/updates?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/updates?saved=1");
}
