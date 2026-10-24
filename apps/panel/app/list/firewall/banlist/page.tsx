import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallBan());
	return (
		<ListView
			title={t("Banlist")}
			result={result}
			columns={[
				{ key: "IP", label: t("IP") },
				{ key: "CHAIN", label: t("Chain") },
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") }
			]}
		></ListView>
	);
}
