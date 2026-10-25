import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysRrd());
	return (
		<ListView
			title={t("RRD")}
			result={result}
			columns={[
				{ key: "TITLE", label: t("Title") },
				{ key: "TYPE", label: t("Type") }
			]}
		></ListView>
	);
}
