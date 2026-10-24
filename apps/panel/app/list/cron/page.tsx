import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listCronJobs(user));
	return (
		<ListView
			title={t("Cron Jobs")}
			result={result}
			columns={[
				{ key: "JOB", label: t("Job") },
				{ key: "SCHEDULE", label: t("Schedule"), format: (_v, row) => [row.MIN, row.HOUR, row.DAY, row.MONTH, row.WDAY].join(" ") },
				{ key: "CMD", label: t("Command") },
				{ key: "SUSPENDED", label: t("Suspended") }
			]}
		></ListView>
	);
}
