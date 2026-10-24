import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysHestiaUpdates());
	return (
		<ListView
			title={t("Updates")}
			result={result}
			columns={[
				{ key: "PACKAGE", label: t("Package") },
				{ key: "VERSION", label: t("Version") },
				{ key: "UPDATE", label: t("Update available") }
			]}
		></ListView>
	);
}
