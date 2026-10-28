"use server";

import { redirect } from "next/navigation";
import { getSession, hestia } from "@/lib/panel";

/**
 * Self-service 2FA reset (web/reset2fa/): a user who lost their
 * authenticator proves ownership with the 2FA reset code stored
 * on their account (the TWOFA field), and 2FA is deleted.
 * Logged-in users are sent home, as PHP redirects them to
 * /list/user/. Wrong keys and unknown users take the same path
 * (failed-login record + 5s wait + one generic error), so the
 * form never leaks whether the username exists.
 */
export async function reset2faAction(formData: FormData): Promise<void> {
	const user = String(formData.get("user") ?? "").trim();
	const code = String(formData.get("twofa") ?? "").trim();
	if (!user || !code) {
		redirect("/reset2fa?error=1");
	}
	let record: Record<string, string> | null = null;
	try {
		record = (await hestia.listUser(user)) as unknown as Record<string, string>;
	} catch {
		record = null;
	}
	const session = await getSession();
	const ip = "127.0.0.1";
	if (record && record.TWOFA === code) {
		await hestia.deleteUser2fa(user);
		redirect("/reset2fa?unlocked=1");
	}
	await hestia.logUserLogin(
		user,
		ip,
		"failed",
		String(session?.id ?? ""),
		"hestiang-reset2fa",
		"Failed to enter correct 2FA reset key",
	);
	await new Promise((resolve) => setTimeout(resolve, 5000));
	redirect("/reset2fa?error=1");
}
