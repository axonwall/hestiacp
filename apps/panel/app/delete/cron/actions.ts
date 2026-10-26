"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete delete cron job (web/delete/cron) after the confirm page's checkbox. */
export async function deleteCronJobAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const job = String(formData.get("job") ?? "");
	const back = `/delete/cron?job=${encodeURIComponent(job)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteCronJob(user, job);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron");
}
