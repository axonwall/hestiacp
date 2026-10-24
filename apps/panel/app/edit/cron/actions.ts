"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Edit a cron job (web/edit/cron): v-change-cron-job replaces the
 *  whole schedule in one call, as in PHP. */
export async function editCronJobAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const job = String(formData.get("job") ?? "");
	const back = `/edit/cron?job=${encodeURIComponent(job)}`;
	if (!csrfValid(session, formData) || !job) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const fields = ["min", "hour", "day", "month", "wday", "cmd"].map((f) =>
		String(formData.get(f) ?? "").trim(),
	);
	if (fields.some((f) => f === "")) redirect(`${back}&error=missing`);
	try {
		const [min, hour, day, month, wday, cmd] = fields;
		await hestia.changeCronJob(user, job, min, hour, day, month, wday, cmd);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
