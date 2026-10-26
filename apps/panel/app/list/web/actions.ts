"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Suspend/unsuspend a web domain from the list, mirroring the PHP bulk endpoints. */
export async function toggleWebDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/web?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendWebDomain(user, domain);
		} else {
			await hestia.unsuspendWebDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/web?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/web?saved=1");
}

/** Bulk web action (PHP /bulk/web/): rebuild/suspend/unsuspend/purge/delete. */
export async function bulkWebAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/web?error=csrf");
	const user = effectiveUser(session);
	const op = String(formData.get("action") ?? "");
	const domains = formData.getAll("domain[]").map(String).filter(Boolean);
	const sys = session.data as unknown as Record<string, string | undefined>;
	if (op === "rebuild" && session.data.userContext !== "admin") {
		redirect("/list/web?error=forbidden");
	}
	if (op === "purge" && sys.WEB_SYSTEM !== "nginx" && sys.PROXY_SYSTEM !== "nginx") {
		redirect("/list/web?error=forbidden");
	}
	try {
		for (const domain of domains) {
			if (op === "rebuild") await hestia.rebuildWebDomain(user, domain);
			else if (op === "suspend") await hestia.suspendWebDomain(user, domain);
			else if (op === "unsuspend") await hestia.unsuspendWebDomain(user, domain);
			else if (op === "purge") await hestia.purgeNginxCache(user, domain);
			else if (op === "delete") await hestia.deleteWebDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/web?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/web?saved=1");
}
