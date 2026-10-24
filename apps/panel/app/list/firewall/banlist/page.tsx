import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import {
	addFirewallBanAction,
	deleteFirewallBanAction,
} from "../actions";

export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallBan());
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("Banlist")}
			result={result}
			columns={[
				{ key: "IP", label: t("IP") },
				{ key: "CHAIN", label: t("Chain") },
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") },
			]}
			rowActions={(key, row) => (
				<form action={deleteFirewallBanAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="ip" value={key} />
					<input type="hidden" name="chain" value={row.CHAIN ?? "INPUT"} />
					<button type="submit" className="link-button">
						{t("Unban")}
					</button>
				</form>
			)}
		>
			<form action={addFirewallBanAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="banIp">{t("Ban an IP")}</label>
				<input id="banIp" name="ip" required placeholder="198.51.100.9" />
				<label htmlFor="banChain">{t("Chain")}</label>
				<input id="banChain" name="chain" defaultValue="INPUT" />
				<button type="submit" className="primary">
					{t("Ban")}
				</button>
			</form>
		</ListView>
	);
}
