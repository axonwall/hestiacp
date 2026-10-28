"use server";

import { compareSync, hashSync } from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import nodemailer from "nodemailer";
import { SESSION_COOKIE, buildFullSessionData, clientIp, hestia, sessions } from "@/lib/panel";
import { composeResetEmail, RESET_EMAIL_FALLBACK_BODY } from "@hestiacp/lib";

/**
 * Password reset (web/reset/index.php, three states):
 *  request — username + contact email; on a match, a fresh reset
 *  code is generated, its bcrypt hash stored via v-change-user-rkey,
 *  and the code emailed (template or translated fallback body).
 *  The reply is the same "instructions sent" redirect on every
 *  path, so the form never leaks whether the account or email
 *  matched; only a recent prior request surfaces the wait message.
 *  complete — code + new password: bcrypt-verify the code against
 *  the stored RKEY, require RKEYEXP within the last 900s, change
 *  the password, and log the user in, as PHP does.
 *
 * Mail delivery is nodemailer: the server SMTP relay when the
 * sys config says USE_SERVER_SMTP=true (PHPMailer's SMTP branch),
 * else the local sendmail binary (PHPMailer's default branch).
 * Send failures are swallowed — PHP ignores PHPMailer errors too
 * and reports "instructions sent" regardless. Live delivery is
 * unverified in the sandbox (no mailer there).
 *
 * Quirk mirrored from PHP: the re-request throttle compares
 * RKEYEXP (the last request's unix time) against now-1, so it
 * only bites within about a second despite the "15 minutes"
 * message; the real 15-minute window is the code-validity check
 * (RKEYEXP within the last 900s). Flagged, not "fixed": changing
 * it would diverge from PHP.
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendResetEmail(
	sys: Record<string, string>,
	to: string,
	toName: string,
	subject: string,
	body: string,
	fromFallbackHost: string,
) {
	const useSmtp = sys.USE_SERVER_SMTP === "true";
	const fromAddr = sys.FROM_EMAIL || `noreply@${fromFallbackHost}`;
	const fromName = sys.FROM_NAME || sys.APP_NAME || "HestiaCP";
	let transporter: ReturnType<typeof nodemailer.createTransport>;
	if (useSmtp) {
		transporter = nodemailer.createTransport({
			host: sys.SERVER_SMTP_HOST,
			port: Number(sys.SERVER_SMTP_PORT) || 587,
			secure: sys.SERVER_SMTP_SECURITY === "ssl",
			auth: { user: sys.SERVER_SMTP_USER, pass: sys.SERVER_SMTP_PASSWD },
		});
	} else {
		transporter = nodemailer.createTransport({ sendmail: true });
	}
	const smtpFrom =
		useSmtp && sys.SERVER_SMTP_ADDR && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sys.SERVER_SMTP_ADDR)
			? sys.SERVER_SMTP_ADDR
			: fromAddr;
	try {
		await transporter.sendMail({
			from: `"${fromName}" <${smtpFrom}>`,
			to: toName ? `"${toName}" <${to}>` : to,
			subject,
			text: body,
			html: body.replace(/\n/g, "<br/>"),
		});
	} catch {
		// PHP ignores PHPMailer failures; the reply is "sent" either way.
	}
}

export async function requestResetAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const email = String(formData.get("email") ?? "").trim();
	if (!user || !email) {
		redirect("/reset");
	}
	const sent = "/reset?sent=1";
	const record = await hestia.listUser(user).catch(() => null);
	if (record) {
		const rkeyexpRaw = await hestia.getUserValue(user, "RKEYEXP").catch(() => "");
		const rkeyexp = Number.parseInt(rkeyexpRaw, 10);
		const now = Math.floor(Date.now() / 1000);
		if (!Number.isNaN(rkeyexp) && !(rkeyexp < now - 1)) {
			redirect("/reset?error=Please%20wait%2015%20minutes%20before%20sending%20a%20new%20request.");
		}
		if (email === record.CONTACT) {
			// PHP: substr(password_hash("", PASSWORD_DEFAULT), 8, 12).
			const rkey = hashSync("", 10).substring(8, 20);
			await hestia.changeUserRkey(user, hashSync(rkey, 10));
			const sys = (await hestia.listSysConfig().catch(() => null))?.config ?? {};
			const info = await hestia.listSysInfo().catch(() => null);
			const hostHeader = (await headers()).get("host") ?? "";
			const bodyHost = hostHeader || info?.HOSTNAME || "localhost";
			const subjectHost = info?.HOSTNAME || bodyHost;
			const date = new Date().toISOString().replace("T", " ").slice(0, 19);
			const template = await hestia.readEmailTemplate("reset_password", record.LANGUAGE || "en");
			let subject: string;
			let body: string;
			if (template) {
				// PHP: the subject uses the bare system hostname,
				// the body uses hostname+port from the request host.
				({ subject } = composeResetEmail(template, {
					date,
					hostname: subjectHost,
					appname: sys.APP_NAME || "HestiaCP",
					user,
					name: record.NAME || user,
					resetcode: rkey,
				}));
				({ body } = composeResetEmail(template, {
					date,
					hostname: bodyHost,
					appname: sys.APP_NAME || "HestiaCP",
					user,
					name: record.NAME || user,
					resetcode: rkey,
				}));
			} else {
				subject = `Password Reset at ${date}`;
				({ body } = composeResetEmail(RESET_EMAIL_FALLBACK_BODY, {
					date,
					hostname: bodyHost,
					appname: sys.APP_NAME || "HestiaCP",
					user,
					name: record.NAME || user,
					resetcode: rkey,
				}));
			}
			await sendResetEmail(sys, record.CONTACT, record.NAME || "", subject, body, subjectHost);
		}
	}
	redirect(sent);
}

export async function completeResetAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const code = String(formData.get("code") ?? "").trim();
	const password = String(formData.get("password") ?? "");
	const confirm = String(formData.get("password_confirm") ?? "");
	const back = `/reset?action=confirm&user=${encodeURIComponent(user)}&code=${encodeURIComponent(code)}`;
	if (!user || !code || !password) {
		redirect("/reset");
	}
	if (password !== confirm) {
		redirect(`${back}&error=Passwords%20do%20not%20match`);
	}
	const record = await hestia.listUser(user).catch(() => null);
	const h = await headers();
	const ip = clientIp(h);
	if (!record || !compareSync(code, record.RKEY ?? "")) {
		await hestia.logUserLogin(
			user,
			ip,
			"failed",
			"",
			h.get("user-agent") ?? "",
			"Invalid Username or Code",
		);
		await sleep(5000);
		redirect(`${back}&error=Invalid%20username%20or%20code`);
	}
	const rkeyexpRaw = await hestia.getUserValue(user, "RKEYEXP").catch(() => "");
	const rkeyexp = Number.parseInt(rkeyexpRaw, 10);
	const now = Math.floor(Date.now() / 1000);
	if (Number.isNaN(rkeyexp) || !(rkeyexp > now - 900)) {
		await hestia.logUserLogin(
			user,
			ip,
			"failed",
			"",
			h.get("user-agent") ?? "",
			"Reset code has been expired",
		);
		redirect(`${back}&error=Code%20has%20been%20expired`);
	}
	await hestia.changeUserPassword(user, password);
	const { data } = await buildFullSessionData(user, ip);
	const id = await sessions.create(data);
	const jar = await cookies();
	jar.set(SESSION_COOKIE, id, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		secure: process.env.NODE_ENV === "production",
	});
	await hestia.logUserLogin(
		user,
		ip,
		"success",
		String(data.token ?? ""),
		h.get("user-agent") ?? "",
	);
	redirect("/users");
}
