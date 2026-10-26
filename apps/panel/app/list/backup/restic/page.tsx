import Link from "next/link";
import { ListView } from "@/components/ListView";
import { RowAction } from "@/components/RowAction";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { bulkResticAction, scheduleResticBackupAction } from "./actions";

/**
 * Incremental (restic) backups (web/list/backup/incremental without a
 * snapshot): the snapshot list, newest first as PHP reverses it, plus
 * the schedule control. The list command returns a JSON array, so the
 * rows are keyed by snapshot ID for the shared ListView.
 */
export default async function ResticBackupsPage() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(async () => {
		const snapshots = await hestia.listUserBackupsRestic(user);
		const rows: Record<string, Record<string, string>> = {};
		for (const snap of [...snapshots].reverse()) {
			if (snap.ID) rows[snap.ID] = snap;
		}
		return rows;
	});
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title="Incremental backups"
			result={result}
			columns={[
				{ key: "ID", label: t("Snapshot") },
				{
					key: "DATE",
					label: t("Date"),
					format: (v, row) => (
						<span className="u-text-bold">{[v, row.TIME].filter(Boolean).join(" ")}</span>
					),
				},
				{
					key: "TYPE",
					label: t("Type"),
					format: () => <span className="u-text-bold">Restic</span>,
				},
				{
					key: "HOSTNAME",
					label: t("Hostname"),
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
			]}
			rowHref={(id) => `/list/backup/restic/detail?snapshot=${encodeURIComponent(id)}`}
			rowActions={(id) => [
				<RowAction
					key="browse"
					href={`/list/backup/restic/browse?snapshot=${encodeURIComponent(id)}`}
					title={t("Browse")}
					icon="fa-folder-open icon-lightblue icon-dim"
				/>,
				<RowAction
					key="detail"
					href={`/list/backup/restic/detail?snapshot=${encodeURIComponent(id)}`}
					title={`${t("Detail")} / ${t("Restore")}`}
					icon="fa-magnifying-glass icon-lightblue"
				/>,
				<RowAction
					key="delete"
					href={`/delete/backup/restic?snapshot=${encodeURIComponent(id)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			checkboxName="backup[]"
			bulkAction={bulkResticAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			containerId="list-backup-restic"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/backup">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<form action={scheduleResticBackupAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<button type="submit" className="button button-secondary">
					<i className="fas fa-circle-plus icon-green"></i>
					{t("Create Snapshot")}
				</button>
			</form>
		</ListView>
	);
}
