"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, hestia, sessions, userContextFor } from "@/lib/panel";

/**
 * Login action. Credential checking is delegated to @hestiacp/lib, which
 * verifies through v-check-user-password using the /tmp secret-file pattern
 * (the secret never appears in argv). On success a server-side session is
 * created (D3) and only its signed id goes into the cookie.
 *
 * Spike scope: no 2FA yet (Phase 1), and the client IP is recorded at login;
 * IP binding enforcement lands with the Phase 1 auth work.
 */
export async function loginAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const secret = String(formData.get("secret") ?? "");
	const headerList = await headers();
	const ip =
		headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";

	let ok = false;
	try {
		ok = user.length > 0 && (await hestia.verifyUserPassword(user, secret, ip));
	} catch {
		ok = false;
	}
	if (!ok) {
		redirect("/login?error=1");
	}

	const now = Date.now();
	const id = await sessions.create({
		user,
		userContext: userContextFor(user),
		ip,
		createdAt: now,
		lastSeenAt: now,
	});
	const jar = await cookies();
	jar.set(SESSION_COOKIE, await sessions.cookieValueFor(id), {
		httpOnly: true,
		sameSite: "lax",
		path: "/",
		// The production panel is HTTPS-only behind Hestia's nginx.
		secure: process.env.NODE_ENV === "production",
	});
	redirect("/users");
}
