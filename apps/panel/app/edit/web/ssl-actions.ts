"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/**
 * Custom SSL certificate for a web domain (edit/web SSL section): the
 * PEM contents are staged by the lib as <domain>.crt/.key/.ca in a temp
 * dir for v-change-web-domain-sslcert, exactly as the PHP page stages
 * them. Runs only when a field actually changed.
 */
export async function editWebDomainSslAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const norm = (s: string) => s.replace(/\r\n/g, "\n");
	const crt = norm(String(formData.get("crt") ?? ""));
	const key = norm(String(formData.get("key") ?? ""));
	const ca = norm(String(formData.get("ca") ?? ""));
	try {
		const current = await hestia.listWebDomainSsl(user, domain).catch(() => null);
		const changed =
			!current || crt !== current.CRT || key !== current.KEY || ca !== (current.CA ?? "");
		if (changed) {
			if (!crt || !key) redirect(`${back}&error=missing`);
			await hestia.changeWebDomainSslcert(user, domain, { crt, key, ca });
			await hestia.restartWeb();
			await hestia.restartProxy();
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
