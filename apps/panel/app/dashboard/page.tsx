import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import { ListView } from "@/components/ListView";

/**
 * Dashboard: the account's usage vs its package quotas, from the
 * v-list-user record's U_* counters and limit fields — the same numbers
 * the PHP panel heads its pages with — plus the monthly stats table.
 */
export default async function Page() {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const record = await hestia.listUser(user).catch(() => null);
	const stats = await loadRows(() => hestia.listUserStats(user));

	const gauges: Array<{ label: string; used?: string; limit?: string; unit?: string }> = record
		? [
				{ label: t("Disk"), used: record.U_DISK, limit: record.DISK_QUOTA, unit: "MB" },
				{ label: t("Bandwidth"), used: record.U_BANDWIDTH, limit: record.BANDWIDTH, unit: "MB" },
				{ label: t("Web Domains"), used: record.U_WEB_DOMAINS, limit: record.WEB_DOMAINS },
				{ label: t("DNS Domains"), used: record.U_DNS_DOMAINS, limit: record.DNS_DOMAINS },
				{ label: t("Mail Domains"), used: record.U_MAIL_DOMAINS, limit: record.MAIL_DOMAINS },
				{ label: t("Databases"), used: record.U_DATABASES, limit: record.DATABASES },
				{ label: t("Cron Jobs"), used: record.U_CRON_JOBS, limit: record.CRON_JOBS },
				{ label: t("Backups"), used: record.U_BACKUPS, limit: record.BACKUPS },
			]
		: [];

	return (
		<div>
			<h1>
				{t("Dashboard")} — {user}
			</h1>
			{record ? (
				<div className="gauges">
					{gauges
						.filter((g) => g.used !== undefined)
						.map((g) => {
							const used = Number(g.used);
							const limit = Number(g.limit);
							const pct =
								g.limit && g.limit !== "unlimited" && limit > 0
									? Math.min(100, Math.round((used / limit) * 100))
									: null;
							return (
								<div className="card gauge" key={g.label}>
									<div className="gauge-label">{g.label}</div>
									<div className="gauge-value">
										{g.used}
										{g.unit ? ` ${g.unit}` : ""}
										{g.limit ? ` / ${g.limit}${g.unit ? ` ${g.unit}` : ""}` : ""}
									</div>
									{pct !== null ? (
										<div className="gauge-bar">
											<div style={{ width: `${pct}%` }} />
										</div>
									) : null}
								</div>
							);
						})}
				</div>
			) : (
				<p className="error">Could not load the account record.</p>
			)}
			<ListView
				title={t("Statistics")}
				result={stats}
				columns={[
					{ key: "DATE", label: t("Date") },
					{ key: "U_DISK", label: t("Disk"), format: (v) => `${v} MB` },
					{ key: "U_BANDWIDTH", label: t("Bandwidth"), format: (v) => `${v} MB` },
					{ key: "U_WEB_DOMAINS", label: t("Web Domains") },
					{ key: "U_DATABASES", label: t("Databases") },
					{ key: "U_CRON_JOBS", label: t("Cron Jobs") },
				]}
			/>
		</div>
	);
}
