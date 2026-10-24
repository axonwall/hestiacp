import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { restoreBackupAction } from "./actions";

const split = (v?: string) =>
	(v ?? "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ backup?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const query = await searchParams;
	const backup = query.backup ?? "";
	const detail = backup
		? await hestia.listUserBackup(user, backup).catch(() => undefined)
		: undefined;
	const token = String(session.data.token ?? "");
	const groups: Array<{ scope: string; label: string; objects: string[] }> = [
		{ scope: "web", label: "Web domain", objects: split(detail?.WEB) },
		{ scope: "dns", label: "DNS domain", objects: split(detail?.DNS) },
		{ scope: "mail", label: "Mail domain", objects: split(detail?.MAIL) },
		{ scope: "db", label: "Database", objects: split(detail?.DB) },
		{ scope: "udir", label: "User directory", objects: split(detail?.USER_DIRS) },
	];
	return (
		<div className="card">
			<h1>
				{t("Restore")} — {backup}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{!detail ? (
				<p className="error">Backup not found.</p>
			) : (
				<>
					<form action={restoreBackupAction}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="backup" value={backup} />
						<input type="hidden" name="scope" value="full" />
						<button type="submit" className="primary">
							{t("Restore everything")}
						</button>
					</form>
					{groups.map((g) =>
						g.objects.length ? (
							<form key={g.scope} action={restoreBackupAction}>
								<input type="hidden" name="token" value={token} />
								<input type="hidden" name="backup" value={backup} />
								<input type="hidden" name="scope" value={g.scope} />
								<label htmlFor={`obj-${g.scope}`}>{g.label}</label>
								<select id={`obj-${g.scope}`} name="object">
									{g.objects.map((o) => (
										<option key={o} value={o}>
											{o}
										</option>
									))}
								</select>
								<button type="submit">{t("Restore")}</button>
							</form>
						) : null,
					)}
					{detail.CRON === "yes" ? (
						<form action={restoreBackupAction}>
							<input type="hidden" name="token" value={token} />
							<input type="hidden" name="backup" value={backup} />
							<input type="hidden" name="scope" value="cron" />
							<button type="submit">{t("Restore cron jobs")}</button>
						</form>
					) : null}
				</>
			)}
			<p>
				<Link href="/list/backup">← {t("Backups")}</Link>
			</p>
		</div>
	);
}
