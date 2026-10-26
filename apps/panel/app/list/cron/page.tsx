import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView, sortByDate } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import {
	bulkCronAction,
	disableCronReportsAction,
	enableCronReportsAction,
	toggleCronJobAction,
} from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const { sort } = await searchParams;
	const result = await loadRows(() => hestia.listCronJobs(user));
	// PHP conditions the report toggles on the user's CRON_REPORTS
	// preference (list_cron.php bulk form + toolbar buttons).
	const record = await hestia.listUser(user).catch(() => null);
	const reports = (record as unknown as Record<string, string> | null)?.CRON_REPORTS;
	return (
		<ListView
			title={t("Cron Jobs")}
			result={result}
			columns={[
				{ key: "CMD", label: t("Command") },
				{ key: "MIN", label: t("Minute"), center: true },
				{ key: "HOUR", label: t("Hour"), center: true },
				{ key: "DAY", label: t("Day"), center: true },
				{ key: "MONTH", label: t("Month"), center: true },
				{ key: "WDAY", label: t("Day of Week"), center: true },
			]}
			rowHref={(key) => `/edit/cron?job=${encodeURIComponent(key)}`}
			rowActions={(key, row) => [
				<RowAction
					href={`/edit/cron?job=${encodeURIComponent(key)}`}
					title={t("Edit")}
					icon="fa-pencil icon-orange"
				/>,
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
				</form>,
				<RowAction
					href={`/delete/cron?job=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("cron job"), plural: t("cron jobs") }}
			checkboxName="job[]"
			bulkAction={bulkCronAction}
			bulkToken={token}
			bulkOptions={[
				...(reports === "yes"
					? [{ value: "delete-cron-reports", label: t("Disable Notifications") }]
					: reports === "no"
						? [{ value: "add-cron-reports", label: t("Enable Notifications") }]
						: [
								{ value: "delete-cron-reports", label: t("Disable Notifications") },
								{ value: "add-cron-reports", label: t("Enable Notifications") },
							]),
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/cron"
			sortOptions={[
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{
					key: "command",
					label: t("Command"),
					value: (_k, row) => row.CMD ?? _k,
					dir: "asc",
				},
			]}
			containerId="list-cron"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/add/cron">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Cron Job")}
			</Link>
			{reports === "yes" ? (
				<form action={disableCronReportsAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<button type="submit" className="button button-secondary">
						{t("Disable Notifications")}
					</button>
				</form>
			) : reports === "no" ? (
				<form action={enableCronReportsAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<button type="submit" className="button button-secondary">
						{t("Enable Notifications")}
					</button>
				</form>
			) : null}
		</ListView>
	);
}
