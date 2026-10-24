import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserBackups(user));
	return (
		<ListView
			title={t("Backups")}
			result={result}
			columns={[
				{ key: "BACKUP", label: t("Backups") },
				{ key: "TYPE", label: t("Type") },
				{ key: "SIZE", label: t("Size"), format: (v) => `${v} MB` },
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") }
			]}
		></ListView>
	);
}
