"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Delete a dns record (web/delete/dns/record) after the confirm page's checkbox. */
export async function deleteDnsRecordAction(formData: FormData): Promise<void> {
	const session = await requireSession();

	const domain = String(formData.get("domain") ?? "");
	const id = String(formData.get("id") ?? "");
	const back = `/delete/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	const user = effectiveUser(session);
	try {
		await hestia.deleteDnsRecord(user, domain, id);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/edit/dns?domain=${encodeURIComponent(domain)}&saved=1`);
}
