"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Create a cron job (web/add/cron): v-add-cron-job. */
export async function addCronJobAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/cron?error=csrf");
	const user = effectiveUser(session);
	const fields = ["min", "hour", "day", "month", "wday", "cmd"].map((f) =>
		String(formData.get(f) ?? "").trim(),
	);
	if (fields.some((f) => f === "")) redirect("/add/cron?error=missing");
	try {
		const [min, hour, day, month, wday, cmd] = fields;
		await hestia.addCronJob(user, min, hour, day, month, wday, cmd);
	} catch (error) {
		redirect(`/add/cron?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron?saved=1");
}
