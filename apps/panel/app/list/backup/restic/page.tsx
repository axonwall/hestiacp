import Link from "next/link";
import { ListView } from "@/components/ListView";
import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import { scheduleResticBackupAction } from "./actions";

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
				{ key: "ID", label: "Snapshot" },
				{ key: "DATE", label: t("Date") },
				{ key: "TIME", label: t("Time") },
				{ key: "SIZE", label: t("Size") },
			]}
			rowActions={(id) => (
				<>
					<Link href={`/list/backup/restic/detail?snapshot=${encodeURIComponent(id)}`}>
						{t("Detail")} / {t("Restore")}
					</Link>{" "}
					<Link href={`/delete/backup/restic?snapshot=${encodeURIComponent(id)}`}>
						{t("Delete")}
					</Link>
				</>
			)}
		>
			<p>
				<Link href="/list/backup">← {t("Backups")}</Link>
			</p>
			<form action={scheduleResticBackupAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<button type="submit" className="primary">
					Create incremental backup
				</button>
			</form>
		</ListView>
	);
}
