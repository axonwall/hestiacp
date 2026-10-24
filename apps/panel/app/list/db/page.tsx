import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listDatabases(user));
	return (
		<ListView
			title={t("Databases")}
			result={result}
			columns={[
				{ key: "DATABASE", label: t("Databases") },
				{ key: "DBUSER", label: t("User") },
				{ key: "HOST", label: t("Host") },
				{ key: "TYPE", label: t("Type") },
				{ key: "U_DISK", label: t("Disk"), format: (v) => `${v} MB` },
				{ key: "SUSPENDED", label: t("Suspended") }
			]}
		></ListView>
	);
}
