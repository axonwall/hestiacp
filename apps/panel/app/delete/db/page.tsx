import { getT, requireSession } from "@/lib/panel";
import { deleteDatabaseAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ database?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const database = query.database ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div>
			<h1>{t("Delete Database")} {database}</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<p>This permanently deletes the database <strong>{database}</strong> and all of its data. There is no undo.</p>
				<form action={deleteDatabaseAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="database" value={database} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
					</label>
					<button type="submit">{t("Delete")}</button>
				</form>
			</div>
			<p>
				<a href="/list/db">{t("Back")}</a>
			</p>
		</div>
	);
}
