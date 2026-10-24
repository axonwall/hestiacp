import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysIps());
	return (
		<ListView
			title={t("IP Addresses")}
			result={result}
			columns={[
				{ key: "IP", label: t("IP") },
				{ key: "OWNER", label: t("Owner") },
				{ key: "STATUS", label: t("Status") },
				{ key: "INTERFACE", label: t("Interface") },
				{ key: "NAT", label: t("NAT") }
			]}
		></ListView>
	);
}
