import { redirect } from "next/navigation";
import Terminal from "@/components/Terminal";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";

/**
 * Web terminal (web/list/terminal): PHP renders the xterm div
 * and the browser talks to the standalone terminal service at
 * wss://host/_shell/ (cutover vhost proxies it to
 * localhost:8085). The service checks the HESTIASID cookie and
 * validates the session via its PHP helper, honouring
 * impersonation (look user) exactly as this panel does.
 * nologin shells are redirected, as PHP redirects them to
 * /list/user/.
 *
 * Live socket handshakes are unverified in the sandbox (no
 * terminal service there); the wiring, cookie name, origin
 * rule, and session-helper path were all confirmed against
 * src/deb/web-terminal/server.js.
 */
export default async function TerminalPage() {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const record = await hestia.listUser(user).catch(() => null);
	if (record?.SHELL === "nologin") {
		redirect("/users");
	}
	return (
		<div className="card">
			<h1>{t("Web terminal")}</h1>
			<Terminal />
		</div>
	);
}
