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
 * SSL for a mail domain (edit/mail SSL section): Let's Encrypt via the
 * mail variant of v-add-letsencrypt-domain (blank-space alias arg +
 * trailing 'yes'), custom certificates staged as <domain>.crt/.key/.ca
 * for v-add-mail-domain-ssl (new) or v-change-mail-domain-sslcert
 * (existing), removal via v-delete-mail-domain-ssl. Mail restarts
 * after any change, as in PHP.
 */
export async function editMailDomainSslAction(
	formData: FormData,
): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/mail?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	let changed = false;
	try {
		const current = await hestia.listMailDomain(user, domain);

		const wantLe = formData.get("letsencrypt") === "yes";
		if (wantLe && current.LETSENCRYPT !== "yes") {
			await hestia.addLetsEncryptDomain(
				user,
				domain,
				" ",
				String(formData.get("sslKeyAlgo") ?? ""),
				true,
			);
			changed = true;
		} else if (!wantLe && current.LETSENCRYPT === "yes") {
			await hestia.deleteLetsEncryptDomain(user, domain, true);
			changed = true;
		}

		const removeSsl = formData.get("removeSsl") === "yes";
		if (removeSsl && current.SSL === "yes" && current.LETSENCRYPT !== "yes") {
			await hestia.deleteMailDomainSsl(user, domain);
			changed = true;
		} else if (!removeSsl) {
			const norm = (s: string) => s.replace(/\r\n/g, "\n");
			const crt = norm(String(formData.get("crt") ?? ""));
			const key = norm(String(formData.get("key") ?? ""));
			const ca = norm(String(formData.get("ca") ?? ""));
			if (crt || key) {
				const sslCurrent =
					current.SSL === "yes"
						? await hestia.listMailDomainSsl(user, domain).catch(() => null)
						: null;
				const certChanged =
					!sslCurrent ||
					crt !== sslCurrent.CRT ||
					key !== sslCurrent.KEY ||
					ca !== (sslCurrent.CA ?? "");
				if (certChanged) {
					if (!crt || !key) redirect(`${back}&error=missing`);
					if (current.SSL === "yes") {
						await hestia.changeMailDomainSslcert(user, domain, { crt, key, ca });
					} else {
						await hestia.addMailDomainSsl(user, domain, { crt, key, ca });
					}
					changed = true;
				}
			}
		}

		if (changed) await hestia.restartMail();
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
