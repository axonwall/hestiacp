"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete delete web domain (web/delete/web) after the confirm page's checkbox. */
export async function deleteWebDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const domain = String(formData.get("domain") ?? "");
	const back = `/delete/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteWebDomain(user, domain);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/web");
}
