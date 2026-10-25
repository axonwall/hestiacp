import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserLog(user));
	return (
		<ListView
			title={t("Log")}
			result={result}
			columns={[
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") },
				{ key: "CATEGORY", label: t("Category") },
				{ key: "LEVEL", label: t("Level") },
				{ key: "MESSAGE", label: t("Message") }
			]}
		></ListView>
	);
}
