"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	SESSION_COOKIE,
	buildFullSessionData,
	clientIp,
	hestia,
	newCsrfToken,
	sessions,
} from "@/lib/panel";
import type { PhpSessionData } from "@hestiacp/lib";

/**
 * Login action, step 1 (password). Credential checking is delegated to
 * @hestiacp/lib (v-check-user-password with the staged secret file).
 *
 * If the account has 2FA enabled (record TWOFA non-empty), no full
 * session is created yet: a *pending* session is stored instead —
 * it carries only the pending username, the login IP, and a CSRF token —
 * and the flow continues at /login/2fa. Deliberate deviation from the PHP
 * panel, which parks the plaintext password in the session between
 * steps; the password is already verified here, so nothing needs to be
 * parked. Login attempts are logged via v-log-user-login, as PHP does.
 *
 * Note: redirect() throws by design in Next — keep it OUTSIDE try/catch.
 *
 * After the password verifies, PHP also rejects login-disabled accounts
 * and accounts whose login IP allowlist does not contain the login IP;
 * both are enforced here, before the 2FA step.
 */
export async function loginAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const secret = String(formData.get("secret") ?? "");
	const headerList = await headers();
	const ip = clientIp(headerList);
	const userAgent = headerList.get("user-agent") ?? "";

	let failed = user.length === 0;
	let failedReason = "";
	let twofaRequired = false;
	if (!failed) {
		try {
			const ok = await hestia.verifyUserPassword(user, secret, ip);
			if (!ok) {
				failed = true;
			} else {
				const record = await hestia.listUser(user);
				if (record.SUSPENDED === "yes") {
					failed = true;
				} else if (record.LOGIN_DISABLED === "yes") {
					// PHP login (web/login/index.php) rejects login-disabled
					// accounts here, before 2FA, with a 2s sleep and a
					// failed log carrying this reason; the per-request
					// check (main.php) does not re-check it, so neither
					// does requireSession.
					failed = true;
					failedReason = "Login disabled for this user";
				} else if (record.LOGIN_USE_IPLIST === "yes") {
					const allowed = (record.LOGIN_ALLOW_IPS ?? "").split(",").map((entry) => entry.trim());
					if (!allowed.includes(ip)) {
						failed = true;
						failedReason = "IP address not in allowed list";
					} else if (record.TWOFA) {
						twofaRequired = true;
					}
				} else if (record.TWOFA) {
					twofaRequired = true;
				}
			}
		} catch {
			failed = true;
		}
	}
	if (failed) {
		if (failedReason) {
			await new Promise((resolve) => setTimeout(resolve, 2000));
			await hestia.logUserLogin(user, ip, "failed", "", userAgent, failedReason);
		} else {
			await hestia.logUserLogin(user, ip, "failed", "", userAgent);
		}
		redirect("/login?error=1");
	}

	const jar = await cookies();
	const cookieOpts = {
		httpOnly: true,
		sameSite: "lax" as const,
		path: "/",
		secure: process.env.NODE_ENV === "production",
	};

	if (twofaRequired) {
		const pending: PhpSessionData = {
			pending_user: user,
			user_combined_ip: ip,
			token: newCsrfToken(),
			failed_twofa: 0,
			LAST_ACTIVITY: Math.floor(Date.now() / 1000),
		};
		const id = await sessions.create(pending);
		jar.set(SESSION_COOKIE, id, cookieOpts);
		redirect("/login/2fa");
	}

	const { data } = await buildFullSessionData(user, ip);
	const id = await sessions.create(data);
	jar.set(SESSION_COOKIE, id, cookieOpts);
	await hestia.logUserLogin(user, ip, "success", String(data.token ?? ""), userAgent);
	redirect("/users");
}
