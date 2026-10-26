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
				{ key: "DESCR", label: t("Description") },
				{ key: "VERSION", label: t("Version"), format: (v, row) => `${v} (${row.ARCH})` },
				{
					key: "UPDATED",
					label: t("Status"),
					format: (v) => (v === "no" ? t("Update available") : t("Up-to-date")),
				},
			]}
		></ListView>
	);
}
