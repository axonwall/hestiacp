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
