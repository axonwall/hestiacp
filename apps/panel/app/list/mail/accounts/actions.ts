"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Suspend/unsuspend a mail account from its list. */
export async function toggleMailAccountAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const account = String(formData.get("account") ?? "");
	const back = `/list/mail/accounts?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendMailAccount(user, domain, account);
		} else {
			await hestia.unsuspendMailAccount(user, domain, account);
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
