import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserStats(user));
	return (
		<ListView
			title={t("Statistics")}
			result={result}
			columns={[
				{ key: "DATE", label: t("Date") },
				{ key: "U_DISK", label: t("Disk"), format: (v) => `${v} MB` },
				{ key: "U_BANDWIDTH", label: t("Bandwidth"), format: (v) => `${v} MB` },
				{ key: "U_WEB_DOMAINS", label: t("Web Domains") },
				{ key: "U_DATABASES", label: t("Databases") },
				{ key: "U_CRON_JOBS", label: t("Cron Jobs") },
			]}
		></ListView>
	);
}
