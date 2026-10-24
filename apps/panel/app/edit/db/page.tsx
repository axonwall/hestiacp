import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { editDatabaseAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ database?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const database = query.database ?? "";
	const record = database
		? await hestia.listDatabase(user, database).catch(() => null)
		: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Database")}</h1>
				<p className="error">{query.error ?? "Database not found."}</p>
				<p><a href="/list/db">{t("Back")}</a></p>
			</div>
		);
	}
	const suffix = record.DBUSER?.startsWith(`${user}_`)
		? record.DBUSER.slice(user.length + 1)
		: record.DBUSER;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit Database")} — {database}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<p>
				{record.TYPE} · {record.HOST} · {record.CHARSET} · {record.U_DISK} MB
			</p>
			<form action={editDatabaseAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="database" value={database} />
				<label htmlFor="dbuser">
					{t("User")} ({user}_…)
				</label>
				<input id="dbuser" name="dbuser" defaultValue={suffix} />
				<label htmlFor="secret">{t("New password")} ({t("leave empty to keep")})</label>
				<input id="secret" name="secret" type="password" autoComplete="new-password" />
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
			<p>
				<a href="/list/db">{t("Back")}</a> ·{" "}
				<a href={`/delete/db?database=${encodeURIComponent(database)}`}>{t("Delete")}</a>
			</p>
		</div>
	);
}
