import Link from "next/link";
import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import { ListView } from "@/components/ListView";
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
					<Link href={`/list/backup/detail?backup=${encodeURIComponent(key)}`}>
						{t("Detail")}
					</Link>{" "}
					<Link href={`/edit/backup/restore?backup=${encodeURIComponent(key)}`}>
						{t("Restore")}
					</Link>{" "}
					<a href={`/download/backup?backup=${encodeURIComponent(key)}`}>
						{t("Download")}
					</a>{" "}
					<Link href={`/delete/backup?backup=${encodeURIComponent(key)}`}>
						{t("Delete")}
					</Link>
				</>
			)}
		>
			<form action={scheduleBackupAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<button type="submit" className="primary">
					{t("Create backup")}
				</button>
			</form>{" "}
			<Link href="/edit/backup/exclusions">{t("Backup exclusions")}</Link>{" "}
			<Link href="/list/backup/restic">Incremental backups</Link>
		</ListView>
	);
}
