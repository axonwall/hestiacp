"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

function splitList(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * Edit a mail account (web/edit/mail account form), changed-only:
 * password (staged), quota, rate (admin), alias + forwarder diffs,
 * fwd-only, autoreply add/change/delete.
 */
export async function editMailAccountAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const account = String(formData.get("account") ?? "");
	const back = `/edit/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(account)}`;
	if (!csrfValid(session, formData) || !domain || !account) {
		redirect(`${back}&error=csrf`);
	}
	const user = effectiveUser(session);
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	try {
		const current = await hestia.listMailAccount(user, domain, account);

		const secret = String(formData.get("secret") ?? "");
		if (secret) {
			await hestia.changeMailAccountPassword(user, domain, account, secret);
		}

		const quota = String(formData.get("quota") ?? "").trim();
		const normalizedQuota = quota === "unlimited" ? "" : quota;
		const currentQuota = current.QUOTA === "unlimited" ? "" : (current.QUOTA ?? "");
		if (normalizedQuota !== currentQuota) {
			await hestia.changeMailAccountQuota(user, domain, account, normalizedQuota);
		}

		if (isAdmin) {
			const rate = String(formData.get("rate") ?? "").trim();
			if (rate !== (current.RATE_LIMIT ?? "")) {
				await hestia.changeMailAccountRateLimit(user, domain, account, rate);
			}
		}

		const postedAliases = splitList(String(formData.get("aliases") ?? ""));
		const currentAliases = splitList(current.ALIAS ?? "");
		for (const alias of currentAliases) {
			if (!postedAliases.includes(alias)) {
				await hestia.deleteMailAccountAlias(user, domain, account, alias);
			}
		}
		for (const alias of postedAliases) {
			if (!currentAliases.includes(alias)) {
				await hestia.addMailAccountAlias(user, domain, account, alias);
			}
		}

		const postedFwd = splitList(String(formData.get("forwards") ?? ""));
		const currentFwd = splitList(current.FWD ?? "");
		for (const fwd of currentFwd) {
			if (!postedFwd.includes(fwd)) {
				await hestia.deleteMailAccountForward(user, domain, account, fwd);
			}
		}
		for (const fwd of postedFwd) {
			if (!currentFwd.includes(fwd)) {
				await hestia.addMailAccountForward(user, domain, account, fwd);
			}
		}

		const fwdOnly = formData.get("fwdOnly") === "yes";
		if (fwdOnly !== (current.FWD_ONLY === "yes")) {
			await hestia.setMailAccountFwdOnly(user, domain, account, fwdOnly);
		}

		const autoreply = formData.get("autoreply") === "yes";
		const message = String(formData.get("autoreplyMessage") ?? "").replace(/\r\n/g, "\n");
		if (!autoreply && current.AUTOREPLY === "yes") {
			await hestia.deleteMailAccountAutoreply(user, domain, account);
		} else if (autoreply) {
			const currentMessage = await hestia
				.listMailAccountAutoreply(user, domain, account)
				.catch(() => "");
			if (current.AUTOREPLY !== "yes" || message !== currentMessage) {
				if (message) {
					await hestia.addMailAccountAutoreply(user, domain, account, message);
				}
			}
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
