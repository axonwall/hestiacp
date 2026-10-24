"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/**
 * Web stats authorization (edit/web stats section): one auth user per
 * domain; v-add-web-domain-stats-user both creates the user and resets
 * its password, v-delete-web-domain-stats-user removes the auth
 * entirely (no username argument).
 */
export async function editWebDomainStatsAuthAction(
	formData: FormData,
): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	try {
		const record = await hestia.listWebDomain(user, domain);
		const currentUser = record.AUTH_USER ?? "";
		const authOn = formData.get("statsAuth") === "yes";
		if (!authOn) {
			if (currentUser) await hestia.deleteWebDomainStatsUser(user, domain);
		} else {
			const statsUser = String(formData.get("statsUser") ?? "").trim();
			const secret = String(formData.get("secret") ?? "");
			if (!statsUser) redirect(`${back}&error=missing`);
			if (statsUser !== currentUser || secret) {
				if (!secret) redirect(`${back}&error=missing`);
				await hestia.addWebDomainStatsUser(user, domain, statsUser, secret);
			}
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
