"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Create a web domain (web/add/web): v-add-web-domain, plus the DNS
 *  zone and/or mail domain when ticked — the lib resolves the NAT IP
 *  for the zone exactly as the PHP page does. */
export async function addWebDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/web?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^www\./, "");
	const ip = String(formData.get("ip") ?? "");
	if (!domain || !ip) redirect("/add/web?error=missing");
	try {
		await hestia.addWebDomain(user, domain, ip, {
			dns: formData.get("dns") === "yes",
			mail: formData.get("mail") === "yes",
		});
	} catch (error) {
		redirect(`/add/web?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/edit/web?domain=${encodeURIComponent(domain)}&saved=1`);
}
