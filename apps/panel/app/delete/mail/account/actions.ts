"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Delete a mail account (web/delete/mail/account) after the confirm page's checkbox. */
export async function deleteMailAccountAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const domain = String(formData.get("domain") ?? "");
	const account = String(formData.get("account") ?? "");
	const back = `/delete/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(account)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteMailAccount(user, domain, account);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/list/mail/accounts?domain=${encodeURIComponent(domain)}&saved=1`);
}
