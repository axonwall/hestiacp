"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendMail } from "@/lib/mail";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";
import { composeAccountReadyEmail } from "@hestiacp/lib";

/**
 * Create a user (web/add/user): the lib stages the secret for v-add-user,
 * then applies language / role / login-disabled through their own commands.
 * When a notify address is given, the account-ready email goes out
 * after creation (PHP sends in the NEW user's language; it does not
 * server-validate the notify address — only the contact email is
 * validated — so neither does this).
 */
export async function addUserAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) {
		redirect("/add/user?error=csrf");
	}
	const user = String(formData.get("user") ?? "").trim();
	const secret = String(formData.get("secret") ?? "");
	const email = String(formData.get("email") ?? "").trim();
	const pkg = String(formData.get("package") ?? "default");
	const name = String(formData.get("name") ?? "").trim();
	const language = String(formData.get("language") ?? "");
	const role = String(formData.get("role") ?? "user");
	const loginDisabled = formData.get("loginDisabled") === "yes";
	const notifyEmail = String(formData.get("notifyEmail") ?? "").trim();
	if (!user || !secret || !email || !name) {
		redirect("/add/user?error=missing");
	}
	try {
		await hestia.addUser({
			user,
			secret,
			email,
			package: pkg,
			name,
			language: language || undefined,
			role,
			loginDisabled,
		});
	} catch (error) {
		redirect(`/add/user?error=${encodeURIComponent(errorMessage(error))}`);
	}
	if (notifyEmail) {
		const sys = (await hestia.listSysConfig().catch(() => null))?.config ?? {};
		const info = await hestia.listSysInfo().catch(() => null);
		const hostHeader = (await headers()).get("host") ?? "";
		const bodyHost = hostHeader || info?.HOSTNAME || "localhost";
		const subjectHost = info?.HOSTNAME || bodyHost;
		const appname = sys.APP_NAME || "HestiaCP";
		const subjectEmail = sys.SUBJECT_EMAIL || "{{subject}}";
		const template = await hestia.readEmailTemplate("account_ready", language || "en");
		const vars = {
			appname,
			user,
			name: name || user,
			password: secret,
		};
		const { subject } = composeAccountReadyEmail(
			template,
			{ ...vars, hostname: subjectHost },
			subjectEmail,
		);
		const { body } = composeAccountReadyEmail(
			template,
			{ ...vars, hostname: bodyHost },
			subjectEmail,
		);
		await sendMail(sys, {
			to: notifyEmail,
			toName: name || user,
			subject,
			body,
			fromFallbackHost: subjectHost,
		});
	}
	redirect(`/users/${encodeURIComponent(user)}`);
}
