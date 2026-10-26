"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/**
 * Webmail alias + SMTP relay for a mail domain (edit/mail sections).
 * Webmail follows PHP's toggle shape (alias set → add, emptied →
 * delete) but only fires on change. Relay: (re)adding requires the
 * password — PHP stages whatever was typed, and an empty field would
 * silently clobber the stored credential, so a settings change
 * without a password is refused instead.
 */
export async function editMailDomainExtrasAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/mail?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	try {
		const current = await hestia.listMailDomain(user, domain);

		const alias = String(formData.get("webmail") ?? "").trim();
		if (alias && alias !== (current.WEBMAIL ?? "")) {
			await hestia.addMailDomainWebmail(user, domain, alias);
		} else if (!alias && current.WEBMAIL) {
			await hestia.deleteMailDomainWebmail(user, domain);
		}

		const relayOn = formData.get("relay") === "yes";
		// U_SMTP_RELAY is 'true', not 'yes' (verified live 2026-10-25):
		// checking only "yes" made the clear branch unreachable, so a
		// relay could never be removed from the panel.
		const currentlyOn = current.U_SMTP_RELAY === "true" || current.U_SMTP_RELAY === "yes";
		if (!relayOn && currentlyOn) {
			await hestia.deleteMailDomainSmtpRelay(user, domain);
		} else if (relayOn) {
			const host = String(formData.get("relayHost") ?? "").trim();
			const relayUser = String(formData.get("relayUser") ?? "").trim();
			const port = String(formData.get("relayPort") ?? "").trim();
			const secret = String(formData.get("relayPass") ?? "");
			const changed =
				!currentlyOn ||
				host !== (current.U_SMTP_RELAY_HOST ?? "") ||
				relayUser !== (current.U_SMTP_RELAY_USERNAME ?? "") ||
				port !== (current.U_SMTP_RELAY_PORT ?? "") ||
				secret !== "";
			if (changed) {
				if (!host || !relayUser || !secret) {
					redirect(`${back}&error=relay`);
				}
				await hestia.addMailDomainSmtpRelay(user, domain, host, relayUser, secret, port);
			}
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
