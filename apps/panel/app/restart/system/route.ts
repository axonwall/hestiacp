import { unlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { hestia, requireSession } from "@/lib/panel";

/**
 * System restart (web/restart/system/): a GET with the session CSRF
 * token, a numeric system_reset_token, and a hostname. The token
 * file in /var/tmp is a double-submit guard: a second visit with
 * the same token just removes the file (and waits, as PHP does)
 * instead of rebooting again. Admin-only; anything invalid just
 * redirects home to the server list without side effects.
 */
export async function GET(request: Request) {
	const session = await requireSession();
	const url = new URL(request.url);
	const home = new URL("/list/server", url);
	const fail = () => Response.redirect(home, 303);
	if (session.data.userContext !== "admin") {
		return fail();
	}
	if (url.searchParams.get("token") !== String(session.data.token ?? "")) {
		return fail();
	}
	const resetToken = url.searchParams.get("system_reset_token") ?? "";
	const hostname = url.searchParams.get("hostname") ?? "";
	if (!/^\d+$/.test(resetToken) || !hostname) {
		return fail();
	}
	const guardFile = `/var/tmp/hst_reset_${resetToken}`;
	if (existsSync(guardFile)) {
		await unlink(guardFile).catch(() => undefined);
		await new Promise((resolve) => setTimeout(resolve, 5000));
		return fail();
	}
	await writeFile(guardFile, "").catch(() => undefined);
	try {
		await hestia.restartSystem();
	} catch {
		// The reboot was requested; the redirect target is going away.
	}
	return fail();
}
