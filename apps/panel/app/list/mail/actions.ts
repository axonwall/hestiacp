"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Suspend/unsuspend a mail domain from the list, mirroring the PHP bulk endpoints. */
export async function toggleMailDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/mail?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendMailDomain(user, domain);
		} else {
			await hestia.unsuspendMailDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/mail?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/mail?saved=1");
}

/** Bulk mail-domain action (PHP /bulk/mail/): rebuild/suspend/unsuspend/delete. */
export async function bulkMailAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/mail?error=csrf");
	const user = effectiveUser(session);
	const op = String(formData.get("action") ?? "");
	const domains = formData.getAll("domain[]").map(String).filter(Boolean);
	if (op === "rebuild" && session.data.userContext !== "admin") {
		redirect("/list/mail?error=forbidden");
	}
	try {
		for (const domain of domains) {
			if (op === "rebuild") await hestia.rebuildMailDomain(user, domain);
			else if (op === "suspend") await hestia.suspendMailDomain(user, domain);
			else if (op === "unsuspend") await hestia.unsuspendMailDomain(user, domain);
			else if (op === "delete") await hestia.deleteMailDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/mail?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/mail?saved=1");
}
