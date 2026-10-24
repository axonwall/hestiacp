import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import {
	deleteBackupExclusionsAction,
	saveBackupExclusionsAction,
} from "./actions";

const SYSTEMS = ["WEB", "DNS", "MAIL", "DB", "USER"] as const;

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const query = await searchParams;
	const exclusions = await hestia
		.listUserBackupExclusions(user)
		.catch(() => ({}) as Record<string, string>);
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Backup exclusions")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p className="ok">Changes have been saved.</p> : null}
			<p>One path per line (or comma-separated) for each system.</p>
			<form action={saveBackupExclusionsAction}>
				<input type="hidden" name="token" value={token} />
				{SYSTEMS.map((system) => (
					<div key={system}>
						<label htmlFor={`ex-${system}`}>{system}</label>
						<textarea
							id={`ex-${system}`}
							name={system}
							rows={3}
							defaultValue={(exclusions[system] ?? "").split(",").join("\n")}
						/>
					</div>
				))}
				<button type="submit" className="primary">
					{t("Save")}
				</button>
			</form>
			<h2>{t("Clear exclusions")}</h2>
			{SYSTEMS.map((system) => (
				<form key={system} action={deleteBackupExclusionsAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="system" value={system} />
					<button type="submit">
						{t("Clear")} {system}
					</button>{" "}
				</form>
			))}
			<p>
				<Link href="/list/backup">← {t("Backups")}</Link>
			</p>
		</div>
	);
}
