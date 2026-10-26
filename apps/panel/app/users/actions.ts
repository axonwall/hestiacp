"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/** Suspend / unsuspend from the users list (v-suspend-user / v-unsuspend-user). */
export async function toggleSuspendAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const user = String(formData.get("user") ?? "");
	const op = String(formData.get("op") ?? "");
	if (!csrfValid(session, formData) || !user) {
		redirect("/users?error=csrf");
	}
	try {
		if (op === "suspend") {
			await hestia.suspendUser(user);
		} else {
			await hestia.unsuspendUser(user);
		}
	} catch (error) {
		redirect(`/users?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/users");
}

/** Bulk user action (PHP /bulk/user/): rebuild variants, counters, suspend/unsuspend/delete. */
export async function bulkUsersAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/users?error=csrf");
	}
	const op = String(formData.get("action") ?? "");
	const users = formData.getAll("user[]").map(String).filter(Boolean);
	try {
		for (const user of users) {
			if (op === "rebuild") await hestia.rebuildAll(user);
			else if (op === "rebuild user") await hestia.rebuildUser(user);
			else if (op === "rebuild web") await hestia.rebuildWebDomains(user);
			else if (op === "rebuild dns") await hestia.rebuildDnsDomains(user);
			else if (op === "rebuild mail") await hestia.rebuildMailDomains(user);
			else if (op === "rebuild db") await hestia.rebuildDatabases(user);
			else if (op === "rebuild cron") await hestia.rebuildCronJobs(user);
			else if (op === "update counters") await hestia.updateUserCounters(user);
			else if (op === "suspend") await hestia.suspendUser(user);
			else if (op === "unsuspend") await hestia.unsuspendUser(user);
			else if (op === "delete") await hestia.deleteUser(user);
		}
	} catch (error) {
		redirect(`/users?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/users?saved=1");
}
