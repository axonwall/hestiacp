import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ backup?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const query = await searchParams;
	const backup = query.backup ?? "";
	const detail = backup
		? await hestia.listUserBackup(user, backup).catch(() => undefined)
		: undefined;
	if (!detail) {
		return (
			<div className="card">
				<h1>{t("Backup")}</h1>
				<p className="error">Backup not found.</p>
				<p>
					<Link href="/list/backup">← {t("Backups")}</Link>
				</p>
			</div>
		);
	}
	const sections: Array<[string, string | undefined]> = [
		["Web domains", detail.WEB],
		["DNS domains", detail.DNS],
		["Mail domains", detail.MAIL],
		["Databases", detail.DB],
		["Cron jobs", detail.CRON],
		["User directories", detail.USER_DIRS],
	];
	return (
		<div className="card">
			<h1>
				{t("Backup")} — {backup}
			</h1>
			<dl className="kv">
				<dt>{t("Type")}</dt>
				<dd>{detail.TYPE}</dd>
				<dt>{t("Size")}</dt>
				<dd>{detail.SIZE} MB</dd>
				<dt>{t("Date")}</dt>
				<dd>
					{detail.DATE} {detail.TIME}
				</dd>
				<dt>{t("Runtime")}</dt>
				<dd>{detail.RUNTIME} min</dd>
			</dl>
			<h2>{t("Contents")}</h2>
			<ul>
				{sections.map(([label, value]) =>
					value ? (
						<li key={label}>
							<strong>{label}:</strong> {value}
						</li>
					) : null,
				)}
			</ul>
			<p>
				<Link href={`/edit/backup/restore?backup=${encodeURIComponent(backup)}`}>
					{t("Restore")}
				</Link>{" "}
				·{" "}
				<a href={`/download/backup?backup=${encodeURIComponent(backup)}`}>
					{t("Download")}
				</a>{" "}
				· <Link href="/list/backup">← {t("Backups")}</Link>
			</p>
		</div>
	);
}
