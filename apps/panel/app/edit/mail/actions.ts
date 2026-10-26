"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/**
 * Edit a mail domain (web/edit/mail), changed-only: antispam /
 * antivirus / DKIM toggles (a selector change regenerates DKIM, as in
 * PHP), reject-spam, catchall add/change/delete, rate limit (admin).
 * SSL, webmail alias and SMTP relay sections are later tranches.
 */
export async function editMailDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/mail?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	try {
		const current = await hestia.listMailDomain(user, domain);

		const antispam = formData.get("antispam") === "yes";
		if (antispam !== (current.ANTISPAM === "yes")) {
			await hestia.setMailDomainAntispam(user, domain, antispam);
		}
		const antivirus = formData.get("antivirus") === "yes";
		if (antivirus !== (current.ANTIVIRUS === "yes")) {
			await hestia.setMailDomainAntivirus(user, domain, antivirus);
		}

		// DKIM: off->delete; selector change while on -> delete + re-add
		const dkim = formData.get("dkim") === "yes";
		const selector = String(formData.get("dkimSelector") ?? "").trim() || "mail";
		if (!dkim && current.DKIM === "yes") {
			await hestia.deleteMailDomainDkim(user, domain);
		} else if (dkim && current.DKIM !== "yes") {
			await hestia.addMailDomainDkim(user, domain, selector);
		} else if (dkim && current.DKIM === "yes" && selector !== (current.DKIM_SELECTOR || "mail")) {
			await hestia.deleteMailDomainDkim(user, domain);
			await hestia.addMailDomainDkim(user, domain, selector);
		}

		const reject = formData.get("reject") === "yes";
		if (reject !== (current.REJECT === "yes")) {
			await hestia.setMailDomainReject(user, domain, reject);
		}

		const catchall = String(formData.get("catchall") ?? "").trim();
		if (!catchall && current.CATCHALL) {
			await hestia.deleteMailDomainCatchall(user, domain);
		} else if (catchall && !current.CATCHALL) {
			await hestia.addMailDomainCatchall(user, domain, catchall);
		} else if (catchall && catchall !== current.CATCHALL) {
			await hestia.changeMailDomainCatchall(user, domain, catchall);
		}

		if (isAdmin) {
			const rate = String(formData.get("rate") ?? "").trim();
			if (rate !== (current.RATE_LIMIT ?? "")) {
				await hestia.changeMailDomainRateLimit(user, domain, rate);
			}
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
