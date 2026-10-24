import Link from "next/link";
import { getT, requireSession } from "@/lib/panel";
import { deleteBackupAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ backup?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const backup = query.backup ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Delete Backup")} — {backup}
			</h1>
			{query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<p>This permanently deletes the backup archive.</p>
			<form action={deleteBackupAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="backup" value={backup} />
				<label>
					<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
				</label>
				<button type="submit" className="danger">
					{t("Delete")}
				</button>
			</form>
			<p>
				<Link href="/list/backup">← {t("Backups")}</Link>
			</p>
		</div>
	);
}
