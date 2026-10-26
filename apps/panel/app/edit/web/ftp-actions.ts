"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/**
 * FTP accounts on a web domain (edit/web FTP section). Mirrors PHP's
 * asymmetry: adding takes the username suffix (the command prefixes
 * <user>_ itself); path/password/delete use the full username. The
 * credentials email PHP sends on add/change is not reproduced.
 */
export async function addWebDomainFtpAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const ftpUser = String(formData.get("ftpUser") ?? "")
		.trim()
		.toLowerCase();
	const secret = String(formData.get("secret") ?? "");
	const path = String(formData.get("path") ?? "").trim();
	if (!ftpUser || !secret) redirect(`${back}&error=missing`);
	try {
		await hestia.addWebDomainFtp(user, domain, ftpUser, secret, path);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}

export async function updateWebDomainFtpAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const ftpUser = String(formData.get("ftpUser") ?? "");
	try {
		if (formData.get("delete") === "yes") {
			await hestia.deleteWebDomainFtp(user, domain, ftpUser);
		} else {
			const path = String(formData.get("path") ?? "").trim();
			const prevPath = String(formData.get("prevPath") ?? "");
			if (path !== prevPath) {
				await hestia.changeWebDomainFtpPath(user, domain, ftpUser, path);
			}
			const secret = String(formData.get("secret") ?? "");
			if (secret) {
				await hestia.changeWebDomainFtpPassword(user, domain, ftpUser, secret);
			}
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
