"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
	SESSION_COOKIE,
	hestia,
	newCsrfToken,
	sessions,
} from "@/lib/panel";
import type { HestiaUser, PhpSessionData } from "@hestiacp/lib";

/**
 * Login action. Credential checking is delegated to @hestiacp/lib, which
 * verifies through v-check-user-password using the /tmp secret-file pattern
 * (the secret never appears in argv).
 *
 * On success the session record is built the way the PHP panel builds it:
 * every sys-config key is merged in (load_hestia_config), plus user,
 * userContext (from the account record's ROLE), an empty look, a fresh
 * CSRF token, the account language, the combined login IP, LAST_ACTIVITY,
 * and the account's shell/role. The record is stored as a PHP-format
 * session file (see lib/panel.ts) under the HESTIASID cookie.
 *
 * Phase 1 scope: no 2FA yet; suspended accounts are refused here
 * (v-get-user-salt's exit 5 in the PHP flow).
 *
 * Note: redirect() throws by design in Next — it must stay OUTSIDE
 * try/catch. Catching a redirect error and re-redirecting from the catch
 * aborts the request (verified live: curl saw a dropped connection).
 */
export async function loginAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const secret = String(formData.get("secret") ?? "");
	const headerList = await headers();
	const ip =
		headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

	let userRecord: HestiaUser | null = null;
	let sysConfig: Record<string, string> = {};
	let failed = user.length === 0;
	if (!failed) {
		try {
			const ok = await hestia.verifyUserPassword(user, secret, ip);
			if (!ok) {
				failed = true;
			} else {
				userRecord = await hestia.listUser(user);
				if (userRecord.SUSPENDED === "yes") {
					failed = true;
				} else {
					const sys = await hestia.listSysConfig();
					sysConfig = sys.config ?? {};
				}
			}
		} catch {
			failed = true;
		}
	}
	if (failed || !userRecord) {
		redirect("/login?error=1");
	}

	const data: PhpSessionData = {
		...sysConfig,
		user,
		userContext: userRecord.ROLE === "admin" ? "admin" : "user",
		look: "",
		token: newCsrfToken(),
		language: userRecord.LANGUAGE ?? "en",
		user_combined_ip: ip,
		LAST_ACTIVITY: Math.floor(Date.now() / 1000),
		login_shell: userRecord.SHELL ?? "",
		role: userRecord.ROLE ?? "",
	};
	const id = await sessions.create(data);
	const jar = await cookies();
	jar.set(SESSION_COOKIE, id, {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		// The production panel is HTTPS-only behind Hestia's nginx.
		secure: process.env.NODE_ENV === "production",
	});
	redirect("/users");
}
