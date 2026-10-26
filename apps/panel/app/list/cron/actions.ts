"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

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

/** Bulk cron action (PHP /bulk/cron/): report toggles apply to the
 * user, suspend/unsuspend/delete apply to the selected jobs. */
export async function bulkCronAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/cron?error=csrf");
	const user = effectiveUser(session);
	const op = String(formData.get("action") ?? "");
	const jobs = formData.getAll("job[]").map(String).filter(Boolean);
	try {
		if (op === "delete-cron-reports") await hestia.deleteCronReports(user);
		else if (op === "add-cron-reports") await hestia.addCronReports(user);
		else
			for (const job of jobs) {
				if (op === "suspend") await hestia.suspendCronJob(user, job);
				else if (op === "unsuspend") await hestia.unsuspendCronJob(user, job);
				else if (op === "delete") await hestia.deleteCronJob(user, job);
			}
	} catch (error) {
		redirect(`/list/cron?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron?saved=1");
}

/** Toolbar report toggles (PHP /add/cron/reports/ and
 * /delete/cron/reports/). */
export async function enableCronReportsAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/cron?error=csrf");
	const user = effectiveUser(session);
	try {
		await hestia.addCronReports(user);
	} catch (error) {
		redirect(`/list/cron?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron?saved=1");
}

export async function disableCronReportsAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/cron?error=csrf");
	const user = effectiveUser(session);
	try {
		await hestia.deleteCronReports(user);
	} catch (error) {
		redirect(`/list/cron?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/cron?saved=1");
}
