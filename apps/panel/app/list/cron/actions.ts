"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Suspend/unsuspend a cron job from the list, mirroring the PHP bulk endpoints. */
export async function toggleCronJobAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/cron?error=csrf");
	const user = effectiveUser(session);
	const job = String(formData.get("job") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendCronJob(user, job);
		} else {
			await hestia.unsuspendCronJob(user, job);
		}
	} catch (error) {
		redirect(`/list/cron?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron?saved=1");
}
