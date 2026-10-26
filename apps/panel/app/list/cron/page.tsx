import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
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
				{
					key: "SCHEDULE",
					label: t("Schedule"),
					format: (_v, row) => [row.MIN, row.HOUR, row.DAY, row.MONTH, row.WDAY].join(" "),
				},
				{ key: "CMD", label: t("Command") },
				{ key: "SUSPENDED", label: t("Suspended") },
			]}
			rowActions={(key, row) => (
				<>
					<RowAction
						href={`/edit/cron?job=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>{" "}
					<form action={toggleCronJobAction} style={{ display: "inline" }}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="job" value={key} />
						<input
							type="hidden"
							name="op"
							value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
						/>
						<RowActionButton
							title={row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
							icon={row.SUSPENDED === "yes" ? "fa-play icon-green" : "fa-pause icon-highlight"}
						/>
					</form>{" "}
					<RowAction
						href={`/delete/cron?job=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/cron">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Cron Job")}
			</Link>
		</ListView>
	);
}
