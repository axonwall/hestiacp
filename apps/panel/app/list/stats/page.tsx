import Link from "next/link";
import { humanizeUsage } from "@hestiacp/lib";
import type { HestiaRow } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** PHP's "Mon YYYY" card header, from the row key parsed as a date. */
function monthLabel(key: string, t: (s: string) => string): string {
	const d = new Date(`${key}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return key;
	return `${t(MONTHS[d.getUTCMonth()])} ${d.getUTCFullYear()}`;
}

/** PHP's "size measure" pair (humanize_usage_size + humanize_usage_measure). */
function usage(value: string): { size: string; measure: string } {
	return humanizeUsage(value);
}

/** PHP's bold-size + plain-measure rendering of one usage value. */
function usagePair(value: string): React.ReactNode {
	const u = usage(value);
	return (
		<>
			<span className="u-text-bold">{u.size}</span> {u.measure}
		</>
	);
}

function countRow(label: string, value: string | undefined): React.ReactNode {
	return (
		<li className="stats-item-list-item">
			<span className="stats-item-list-item-label">{label}:</span>
			<span className="stats-item-list-item-value">{value ?? ""}</span>
		</li>
	);
}

export default async function StatsPage({
	searchParams,
}: {
	searchParams: Promise<{ user?: string }>;
}) {
	const session = await requireSession();
	const query = await searchParams;
	const t = await getT();
	const sys = session.data as unknown as Record<string, string | undefined>;
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	const impersonating = Boolean(session.data.look);
	const showAdminTools = isAdmin && !impersonating;
	const selectedUser = query.user ?? "";

	// PHP web/list/stats/index.php: admin (not impersonating) with no
	// ?user= sees overall statistics; with ?user= that user's; everyone
	// else sees their own (effective) user's. Rows arrive oldest-first
	// and are reversed for display.
	let result: { rows: Record<string, HestiaRow> } | { error: string };
	let users: string[] = [];
	if (showAdminTools) {
		try {
			users = await hestia.listSysUsers();
		} catch {
			users = [];
		}
		if (selectedUser) {
			result = await loadRows(() => hestia.listUserStats(selectedUser));
		} else {
			result = await loadRows(() => hestia.listUsersStats());
		}
	} else {
		result = await loadRows(() => hestia.listUserStats(effectiveUser(session)));
	}
	if ("error" in result) {
		return (
			<div>
				<p className="error">{result.error}</p>
			</div>
		);
	}
	const entries = Object.entries(result.rows).reverse();
	const hideRoot = sys.POLICY_SYSTEM_HIDE_ADMIN === "yes";
	const rootUser = sys.ROOT_USER;
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<div className="toolbar-buttons">
						{showAdminTools ? (
							<Link className="button button-secondary" href="/list/stats/">
								<i className="fas fa-binoculars icon-lightblue"></i>
								{t("Overall Statistics")}
							</Link>
						) : null}
					</div>
					<div className="toolbar-right">
						{showAdminTools ? (
							<form action="/list/stats/" method="get">
								<input type="hidden" name="token" value={token} />
								<select className="form-select" name="user" defaultValue={selectedUser}>
									<option value="">{t("Show Per User")}</option>
									{users
										.filter((u) => !(hideRoot && rootUser && u === rootUser))
										.map((u) => (
											<option key={u} value={u}>
												{u}
											</option>
										))}
								</select>
								<button
									type="submit"
									className="toolbar-input-submit"
									title={t("Apply to selected")}
								>
									<i className="fas fa-arrow-right"></i>
								</button>
							</form>
						) : null}
						<div className="toolbar-search">
							<form action="/search/" method="get">
								<input type="hidden" name="token" value={token} />
								<input
									type="search"
									className="form-control js-search-input"
									name="q"
									title={t("Search")}
								/>
								<button type="submit" className="toolbar-input-submit" title={t("Search")}>
									<i className="fas fa-magnifying-glass"></i>
								</button>
							</form>
						</div>
					</div>
				</div>
			</div>
			<div className="container">
				<div className="stats">
					{entries.map(([key, row]) => (
						<div className="stats-item" key={key}>
							<div className="stats-item-header">
								<i className="fas fa-chart-bar icon-dim stats-item-header-icon u-mr10"></i>
								<h2 className="stats-item-header-title">{monthLabel(key, t)}</h2>
							</div>
							<div className="stats-item-content">
								<div className="stats-item-summary">
									<h3 className="stats-item-summary-title">
										<span className="u-text-bold">
											<i
												className="fas fa-right-left icon-dim icon-large u-mr5"
												title={t("Bandwidth")}
											></i>
											{t("Bandwidth")}
										</span>
										<span className="u-mr10">
											{usagePair(row.U_BANDWIDTH ?? "")}
											{" / "}
											{usagePair(row.BANDWIDTH ?? "")}
										</span>
									</h3>
									<ul className="stats-item-summary-list u-mb10">
										<li className="stats-item-summary-list-item">
											<span>{isAdmin || row.IP_OWNED !== "0" ? `${t("IP Addresses")}:` : ""}</span>
											<span>
												<span className="u-text-bold">{row.IP_OWNED ?? ""}</span> {t("IPs")}
											</span>
										</li>
									</ul>
									<h3 className="stats-item-summary-title">
										<span className="u-text-bold">
											<i className="fas fa-hard-drive icon-dim icon-large u-mr5" title="Disk"></i>
											{t("Disk")}
										</span>
										<span className="u-mr10">
											{usagePair(row.U_DISK ?? "")}
											{" / "}
											{usagePair(row.DISK_QUOTA ?? "")}
										</span>
									</h3>
									<ul className="stats-item-summary-list">
										<li className="stats-item-summary-list-item">
											<span>{t("Web")}:</span>
											<span>{usagePair(row.U_DISK_WEB ?? "")}</span>
										</li>
										<li className="stats-item-summary-list-item u-mb5">
											<span>{t("Databases")}:</span>
											<span>{usagePair(row.U_DISK_DB ?? "")}</span>
										</li>
										<li className="stats-item-summary-list-item">
											<span>{t("Mail")}:</span>
											<span>{usagePair(row.U_DISK_MAIL ?? "")}</span>
										</li>
										<li className="stats-item-summary-list-item">
											<span>{t("User Directory")}:</span>
											<span>{usagePair(row.U_DISK_DIRS ?? "")}</span>
										</li>
									</ul>
								</div>
								<ul className="stats-item-list">
									{countRow(t("Web Domains"), row.U_WEB_DOMAINS)}
									{countRow(t("Mail Domains"), row.U_MAIL_DOMAINS)}
									{countRow(t("SSL Domains"), row.U_WEB_SSL)}
									{countRow(t("Mail Accounts"), row.U_MAIL_ACCOUNTS)}
									{countRow(t("Web Aliases"), row.U_WEB_ALIASES)}
									{countRow(t("Databases"), row.U_DATABASES)}
									{countRow(t("DNS Zones"), row.U_DNS_DOMAINS)}
									{countRow(t("Cron Jobs"), row.U_CRON_JOBS)}
									{countRow(t("DNS Records"), row.U_DNS_RECORDS)}
									{countRow(t("Backups"), row.U_BACKUPS)}
								</ul>
							</div>
						</div>
					))}
				</div>
				<div className="units-table-footer">
					<p>
						{entries.length} {entries.length === 1 ? t("month") : t("months")}
					</p>
				</div>
			</div>
		</div>
	);
}
