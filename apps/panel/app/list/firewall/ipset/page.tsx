import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallIpset());
	return (
		<ListView
			title={t("IP Sets")}
			result={result}
			columns={[
				{ key: "IPSET", label: t("IP Sets") },
				{ key: "SOURCE", label: t("Source") },
				{ key: "AUTOUPDATE", label: t("Autoupdate") },
				{ key: "IP_VERSION", label: t("Version") }
			]}
		></ListView>
	);
}
