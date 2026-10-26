import { requireSession } from "@/lib/panel";

/**
 * /list/terminal/ — shell placeholder for Phase 4. The PHP panel's page
 * embeds xterm and talks to the standalone Node terminal server, whose
 * auth shim reads the PHP-format session this panel now writes — so the
 * hand-off is already compatible; wiring the socket UI is Phase 4 work.
 */
export default async function TerminalPage() {
	await requireSession();
	return (
		<div className="card">
			<h1>Web terminal</h1>
			<p>
				The terminal UI lands in Phase 4. Session compatibility is already in place: the terminal
				server authenticates against the same PHP-format session files this panel writes.
			</p>
		</div>
	);
}
