import Link from "next/link";
import { humanizeTime, humanizeUsage } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction } from "@/components/RowAction";
import { bulkBackupAction, scheduleBackupAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserBackups(user));
	const token = String(session.data.token ?? "");
	const usage = (v: string) => {
		const { size, measure } = humanizeUsage(v);
		return (
			<>
				<span className="u-text-bold">{size}</span> <span className="u-text-small">{measure}</span>
			</>
		);
	};
	return (
		<ListView
			title={t("Backups")}
			result={result}
			columns={[
				{ key: "BACKUP", label: t("File Name") },
				{ key: "DATE", label: t("Date") },
				{ key: "SIZE", label: t("Size"), format: usage },
				{ key: "TYPE", label: t("Type") },
				{
					key: "RUNTIME",
					label: t("Runtime"),
					format: (v) => humanizeTime(v, t),
				},
			]}
			rowHref={(key) => `/edit/backup/restore?backup=${encodeURIComponent(key)}`}
			rowActions={(key) => [
				<RowAction
					key="download"
					href={`/download/backup?backup=${encodeURIComponent(key)}`}
					title={t("Download")}
					icon="fa-file-arrow-down icon-lightblue"
					plain
				/>,
				<RowAction
					key="restore"
					href={`/edit/backup/restore?backup=${encodeURIComponent(key)}`}
					title={t("Restore")}
					icon="fa-arrow-rotate-left icon-green"
				/>,
				<RowAction
					key="detail"
					href={`/list/backup/detail?backup=${encodeURIComponent(key)}`}
					title={t("Detail")}
					icon="fa-magnifying-glass icon-lightblue"
				/>,
				<RowAction
					key="delete"
					href={`/delete/backup?backup=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("backup"), plural: t("backups") }}
			checkboxName="backup[]"
			bulkAction={bulkBackupAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			containerId="list-backup"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<form action={scheduleBackupAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<button type="submit" className="button button-secondary">
					<i className="fas fa-circle-plus icon-green"></i>
					{t("Create Backup")}
				</button>
			</form>{" "}
			<Link className="button button-secondary" href="/edit/backup/exclusions">
				<i className="fas fa-folder-minus icon-orange"></i>
				{t("Backup Exclusions")}
			</Link>{" "}
			<Link className="button button-secondary" href="/list/backup/restic">
				<i className="fas fa-vault icon-blue"></i>
				{t("Incremental Backups")}
			</Link>
		</ListView>
	);
}
