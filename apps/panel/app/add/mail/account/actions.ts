"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

function splitList(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/** Create a mail account (web/add/mail, account form): the secret is
 *  staged by the lib; aliases / forwarders / fwd-only / rate follow in
 *  the PHP page's order. */
export async function addMailAccountAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const back = "/add/mail/account";
	if (!csrfValid(session, formData)) redirect(`${back}?error=csrf`);
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	const account = String(formData.get("account") ?? "")
		.trim()
		.toLowerCase();
	const secret = String(formData.get("secret") ?? "");
	if (!domain || !account || !secret) redirect(`${back}?error=missing`);
	try {
		await hestia.addMailAccount(
			user,
			domain,
			account,
			secret,
			String(formData.get("quota") ?? "").trim(),
		);
		for (const alias of splitList(String(formData.get("aliases") ?? ""))) {
			await hestia.addMailAccountAlias(user, domain, account, alias);
		}
		for (const fwd of splitList(String(formData.get("forwards") ?? ""))) {
			await hestia.addMailAccountForward(user, domain, account, fwd);
		}
		if (formData.get("fwdOnly") === "yes") {
			await hestia.setMailAccountFwdOnly(user, domain, account, true);
		}
		const rate = String(formData.get("rate") ?? "").trim();
		if (rate && session.data.userContext === "admin" && !session.data.look) {
			await hestia.changeMailAccountRateLimit(user, domain, account, rate);
		}
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/list/mail/accounts?domain=${encodeURIComponent(domain)}&saved=1`);
}
