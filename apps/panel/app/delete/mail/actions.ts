"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete delete mail domain (web/delete/mail) after the confirm page's checkbox. */
export async function deleteMailDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const domain = String(formData.get("domain") ?? "");
	const back = `/delete/mail?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteMailDomain(user, domain);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/mail");
}
