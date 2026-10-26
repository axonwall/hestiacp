import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { addDatabaseAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const hosts = await hestia.listDatabaseHosts().catch((): Record<string, HestiaRow> => ({}));
	const hostNames = Object.keys(hosts);
	const charsets = (hosts[hostNames[0]]?.CHARSETS ?? "utf8mb4").split(",");
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Add Database")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addDatabaseAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="database">
					{t("Database")} ({user}_…)
				</label>
				<input className="form-control" id="database" name="database" required />
				<label htmlFor="dbuser">
					{t("User")} ({user}_…)
				</label>
				<input className="form-control" id="dbuser" name="dbuser" required />
				<label htmlFor="secret">{t("Password")}</label>
				<input
					className="form-control"
					id="secret"
					name="secret"
					type="password"
					required
					autoComplete="new-password"
				/>
				<label htmlFor="host">{t("Host")}</label>
				<select className="form-select" id="host" name="host">
					{hostNames.map((h) => (
						<option key={h} value={h}>
							{h}
						</option>
					))}
				</select>
				<label htmlFor="type">{t("Type")}</label>
				<select className="form-select" id="type" name="type">
					{[...new Set(Object.values(hosts).map((h) => h.TYPE))].map((ty) => (
						<option key={ty} value={ty}>
							{ty}
						</option>
					))}
					{hostNames.length === 0 ? <option value="mysql">mysql</option> : null}
				</select>
				<label htmlFor="charset">{t("Charset")}</label>
				<select className="form-select" id="charset" name="charset">
					{charsets.map((cs) => (
						<option key={cs} value={cs}>
							{cs}
						</option>
					))}
				</select>
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
		</div>
	);
}
