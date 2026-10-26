"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { buildFullSessionData, clientIp, getSession, hestia, sessions } from "@/lib/panel";

/**
 * Login action, step 2 (TOTP code), for sessions in the pending state
 * created by the password step. Verification is v-check-user-2fa — the
 * secret never leaves the bash layer. Mirrors web/login's rules:
 * codes are < 10 chars (longer input is invalid, not a recovery code —
 * Hestia has none in this flow), and repeated failures are logged via
 * v-log-user-login from the third attempt on, as PHP does. On success
 * the pending session is promoted in place to a full session.
 */
export async function twofaAction(formData: FormData): Promise<void> {
	const session = await getSession();
	const pendingUser = session?.data.pending_user;
	if (!session || typeof pendingUser !== "string" || !pendingUser) {
		redirect("/login");
	}
	const headerList = await headers();
	const ip = clientIp(headerList);
	const userAgent = headerList.get("user-agent") ?? "";
	const code = String(formData.get("twofa") ?? "").trim();

	let ok = false;
	if (code.length > 0 && code.length < 10) {
		ok = await hestia.checkUser2fa(pendingUser, code).catch(() => false);
	}
	if (!ok) {
		const attempts = Number(session.data.failed_twofa ?? 0) + 1;
		session.data.failed_twofa = attempts;
		await sessions.set(session.id, session.data);
		if (attempts > 2) {
			await hestia.logUserLogin(
				pendingUser,
				ip,
				"failed",
				String(session.data.token ?? ""),
				userAgent,
				"Invalid or missing 2FA token",
			);
		}
		redirect("/login/2fa?error=1");
	}

	const { data } = await buildFullSessionData(pendingUser, ip);
	await sessions.set(session.id, data);
	await hestia.logUserLogin(pendingUser, ip, "success", String(data.token ?? ""), userAgent);
	redirect("/users");
}
