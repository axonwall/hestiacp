import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { toggleCronJobAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
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
			rowActions={(key, row) => (<>
				<Link href={`/edit/cron?job=${encodeURIComponent(key)}`}>{t("Edit")}</Link>
				{" "}
				<form action={toggleCronJobAction} style={{ display: "inline" }}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="job" value={key} />
										<input type="hidden" name="op" value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"} />
										<button type="submit" className="link-button">{row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}</button>
									</form>
				{" "}
				<Link href={`/delete/cron?job=${encodeURIComponent(key)}`}>{t("Delete")}</Link>
			</>)}
		>
			<p><Link className="button" href="/add/cron">{t("Add Cron Job")}</Link></p>
		</ListView>
	);
}
