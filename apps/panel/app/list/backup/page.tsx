import Link from "next/link";
import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction } from "@/components/RowAction";
import { scheduleBackupAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserBackups(user));
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("Backups")}
			result={result}
			columns={[
				{ key: "BACKUP", label: t("Backups") },
				{ key: "TYPE", label: t("Type") },
				{ key: "SIZE", label: t("Size"), format: (v) => `${v} MB` },
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") },
			]}
			rowActions={(key) => (
				<>
					<RowAction
						href={`/list/backup/detail?backup=${encodeURIComponent(key)}`}
						title={t("Detail")}
						icon="fa-magnifying-glass icon-lightblue"
					/>
					<RowAction
						href={`/edit/backup/restore?backup=${encodeURIComponent(key)}`}
						title={t("Restore")}
						icon="fa-arrow-rotate-left icon-green"
					/>
					<RowAction
						href={`/download/backup?backup=${encodeURIComponent(key)}`}
						title={t("Download")}
						icon="fa-file-arrow-down icon-lightblue"
						plain
					/>
					<RowAction
						href={`/delete/backup?backup=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<form action={scheduleBackupAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<button type="submit" className="button button-secondary">
					<i className="fas fa-circle-plus icon-green"></i>
					{t("Create backup")}
				</button>
			</form>{" "}
			<Link className="button button-secondary" href="/edit/backup/exclusions">
				<i className="fas fa-folder-minus icon-orange"></i>
				{t("Backup exclusions")}
			</Link>{" "}
			<Link className="button button-secondary" href="/list/backup/restic">
				<i className="fas fa-vault icon-blue"></i>
				Incremental backups
			</Link>
		</ListView>
	);
}
