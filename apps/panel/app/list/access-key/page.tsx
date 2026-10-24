import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listAccessKeys(user));
	return (
		<ListView
			title={t("Access Keys")}
			result={result}
			columns={[
				{ key: "ACCESS_KEY_ID", label: t("Access Keys") },
				{ key: "COMMENT", label: t("Comment") },
				{ key: "APIS", label: t("APIs") },
				{ key: "SUSPENDED", label: t("Suspended") },
				{ key: "DATE", label: t("Date") }
			]}
		></ListView>
	);
}
