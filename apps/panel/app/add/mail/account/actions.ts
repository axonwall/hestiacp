"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendMail } from "@/lib/mail";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";
import { composeEmailCredentialsEmail } from "@hestiacp/lib";

function splitList(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((s) => s.trim())
		.filter(Boolean);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create a mail account (web/add/mail, account form): the secret is
 *  staged by the lib; aliases / forwarders / fwd-only / rate follow in
 *  the PHP page's order. When a notify address is given
 *  (server-validated, as PHP validates v_send_email before
 *  creation), the credentials email goes out after creation in the
 *  session language. */
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
	const notifyEmail = String(formData.get("notifyEmail") ?? "").trim();
	if (!domain || !account || !secret) redirect(`${back}?error=missing`);
	if (notifyEmail && !EMAIL_RE.test(notifyEmail)) {
		redirect(`${back}?error=Please%20enter%20a%20valid%20email%20address.`);
	}
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
		// PHP's blackhole: forward ":blackhole:" and discard the
		// forwarder list entirely.
		if (formData.get("blackhole") === "yes") {
			await hestia.addMailAccountForward(user, domain, account, ":blackhole:");
		} else {
			for (const fwd of splitList(String(formData.get("forwards") ?? ""))) {
				await hestia.addMailAccountForward(user, domain, account, fwd);
			}
		}
		if (formData.get("fwdOnly") === "yes") {
			await hestia.setMailAccountFwdOnly(user, domain, account, true);
		}
		const rate = String(formData.get("rate") ?? "").trim();
		// PHP gates the rate only on userContext == "admin" — an
		// impersonating admin may set it too.
		if (rate && session.data.userContext === "admin") {
			await hestia.changeMailAccountRateLimit(user, domain, account, rate);
		}
	} catch (error) {
		redirect(`${back}?error=${encodeURIComponent(errorMessage(error))}`);
	}
	if (notifyEmail) {
		const domainLower = domain.toLowerCase();
		const sys = (await hestia.listSysConfig().catch(() => null))?.config ?? {};
		const info = await hestia.listSysInfo().catch(() => null);
		const hostHeader = (await headers()).get("host") ?? "";
		const requestHost = hostHeader.split(":")[0] || info?.HOSTNAME || "localhost";
		// PHP's webmail base: http://<request host>/<domain's webmail
		// alias>/, overridden by the system WEBMAIL_ALIAS when set;
		// the body value appends "." + domain to either form.
		const domainRecord = await hestia.listMailDomain(user, domain).catch(() => null);
		const rawAlias = domainRecord?.WEBMAIL_ALIAS;
		const domainAlias = typeof rawAlias === "string" ? rawAlias : "";
		let webmailBase = `http://${requestHost}/${domainAlias}/`;
		if (sys.WEBMAIL_ALIAS) webmailBase = sys.WEBMAIL_ALIAS;
		const webmail = `${webmailBase}.${domainLower}`;
		const subjectHost = info?.HOSTNAME || requestHost;
		const appname = sys.APP_NAME || "HestiaCP";
		const subjectEmail = sys.SUBJECT_EMAIL || "{{subject}}";
		const rawLanguage = session.data.language;
		const template = await hestia.readEmailTemplate(
			"email_credentials",
			typeof rawLanguage === "string" ? rawLanguage : "en",
		);
		const vars = {
			appname,
			account,
			domain: domainLower,
			password: secret,
			webmail,
		};
		const { subject } = composeEmailCredentialsEmail(
			template,
			{ ...vars, hostname: subjectHost },
			subjectEmail,
		);
		const { body } = composeEmailCredentialsEmail(
			template,
			{ ...vars, hostname: `mail.${domainLower}` },
			subjectEmail,
		);
		await sendMail(sys, {
			to: notifyEmail,
			subject,
			body,
			fromFallbackHost: subjectHost,
		});
	}
	redirect(`/list/mail/accounts?domain=${encodeURIComponent(domain)}&saved=1`);
}
