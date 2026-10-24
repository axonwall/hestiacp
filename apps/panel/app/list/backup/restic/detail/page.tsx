import Link from "next/link";
import { notFound } from "next/navigation";
import {
	effectiveUser,
	getT,
	hestia,
	requireSession,
} from "@/lib/panel";
import {
	restoreResticFullAction,
	restoreResticObjectAction,
} from "./actions";

/**
 * One restic snapshot (web/list/backup/incremental?snapshot=): the
 * contents and the restore controls — full snapshot, or one typed
 * object in the schedule endpoint's argument shapes (cron restores
 * pass the type alone).
 */
const SECTIONS: Array<{ type: string; field: string; label: string }> = [
	{ type: "web", field: "WEB", label: "Web domain" },
	{ type: "dns", field: "DNS", label: "DNS domain" },
	{ type: "mail", field: "MAIL", label: "Mail domain" },
	{ type: "db", field: "DB", label: "Database" },
	{ type: "dir", field: "USER_DIRS", label: "Directory" },
];

export default async function ResticDetailPage({
	searchParams,
}: {
	searchParams: Promise<{ snapshot?: string; notice?: string }>;
}) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const { snapshot = "", notice } = await searchParams;
	const record = snapshot
		? await hestia.listUserBackupRestic(user, snapshot).catch(() => undefined)
		: undefined;
	if (!record) notFound();
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<p>
				<Link href="/list/backup/restic">← Incremental backups</Link>
			</p>
			<h1>
				{t("Snapshot")} {snapshot}
			</h1>
			{notice ? <p className="notice">Restore scheduled.</p> : null}
			<dl>
				{Object.entries(record).map(([key, value]) =>
					value ? (
						<div key={key}>
							<dt>{key}</dt>
							<dd>{value}</dd>
						</div>
					) : null,
				)}
			</dl>
			<form action={restoreResticFullAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="snapshot" value={snapshot} />
				<button type="submit" className="primary">
					Restore everything
				</button>
			</form>
			<p>
				<a
					href={`/list/backup/restic/browse?snapshot=${encodeURIComponent(snapshot)}`}
				>
					Browse files →
				</a>
			</p>
			<h2>Restore one object</h2>
			{SECTIONS.map(({ type, field, label }) => {
				const objects = (record[field] ?? "")
					.split(/\s+/)
					.map((s) => s.trim())
					.filter(Boolean);
				if (objects.length === 0) return null;
				return (
					<form key={type} action={restoreResticObjectAction} className="inline-form">
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="snapshot" value={snapshot} />
						<input type="hidden" name="type" value={type} />
						<label>
							{label}{" "}
							<select name="object">
								{objects.map((o) => (
									<option key={o} value={o}>
										{o}
									</option>
								))}
							</select>
						</label>
						<button type="submit">{t("Restore")}</button>
					</form>
				);
			})}
			{record.CRON === "yes" ? (
				<form action={restoreResticObjectAction} className="inline-form">
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="snapshot" value={snapshot} />
					<input type="hidden" name="type" value="cron" />
					<span>Cron jobs</span>
					<button type="submit">{t("Restore")}</button>
				</form>
			) : null}
		</div>
	);
}
