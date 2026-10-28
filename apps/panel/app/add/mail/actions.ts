"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Create a mail domain (web/add/mail): v-add-mail-domain with the
 *  feature toggles, plus the reject-spam flag when ticked. */
export async function addMailDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/mail?error=csrf");
	const user = effectiveUser(session);
	// PHP strips a leading www. from the domain; see add/dns for the
	// note on the strict dotted form versus PHP's looser /^www./.
	const domain = String(formData.get("domain") ?? "")
		.trim()
		.toLowerCase()
		.replace(/^www\./, "");
	if (!domain) redirect("/add/mail?error=missing");
	const antispam = formData.get("antispam") === "yes";
	try {
		await hestia.addMailDomain(user, domain, {
			antispam,
			antivirus: formData.get("antivirus") === "yes",
			dkim: formData.get("dkim") === "yes",
			dkimSelector: String(formData.get("dkimSelector") ?? "mail") || "mail",
		});
		if (antispam && formData.get("reject") === "yes") {
			await hestia.setMailDomainReject(user, domain, true);
		}
		const webmail = String(formData.get("webmail") ?? "").trim();
		if (webmail) {
			await hestia.addMailDomainWebmail(user, domain, webmail);
		}
		if (formData.get("relay") === "yes") {
			const host = String(formData.get("relayHost") ?? "").trim();
			const relayUser = String(formData.get("relayUser") ?? "").trim();
			const secret = String(formData.get("relayPass") ?? "");
			if (host && relayUser && secret) {
				await hestia.addMailDomainSmtpRelay(
					user,
					domain,
					host,
					relayUser,
					secret,
					String(formData.get("relayPort") ?? "").trim(),
				);
			}
		}
	} catch (error) {
		redirect(`/add/mail?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/edit/mail?domain=${encodeURIComponent(domain)}&saved=1`);
}
