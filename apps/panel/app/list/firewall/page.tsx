import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallRules());
	return (
		<ListView
			title={t("Firewall")}
			result={result}
			columns={[
				{ key: "RULE", label: t("Rule") },
				{ key: "ACTION", label: t("Action") },
				{ key: "PROTOCOL", label: t("Protocol") },
				{ key: "PORT", label: t("Port") },
				{ key: "IP", label: t("IP") },
				{ key: "COMMENT", label: t("Comment") },
				{ key: "SUSPENDED", label: t("Suspended") }
			]}
		><p><a href="/list/firewall/banlist">{t("Banlist")}</a>{" · "}<a href="/list/firewall/ipset">{t("IP Sets")}</a></p></ListView>
	);
}
