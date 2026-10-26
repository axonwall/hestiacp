import Link from "next/link";
import { humanizeUsage } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView, sortByDate, sortByIp, sortByName, statusIcon } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkWebAction, toggleWebDomainAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	const sys = session.data as unknown as Record<string, string | undefined>;
	const nginxCache = sys.WEB_SYSTEM === "nginx" || sys.PROXY_SYSTEM === "nginx";
	const { sort } = await searchParams;
	const result = await loadRows(() => hestia.listWebDomains(user));
	// PHP shows the IP's NAT/public address when the sys IP has one
	// (list_web.php: $ips[$ip]["NAT"]).
	const sysIps = await hestia.listSysIps().catch(() => ({}));
	const nat: Record<string, string> = {};
	for (const [ip, row] of Object.entries(sysIps)) {
		if (row.NAT) nat[ip] = row.NAT;
	}
	const usage = (v: string) => {
		const { size, measure } = humanizeUsage(v);
		return (
			<>
				<span className="u-text-bold">{size}</span> <span className="u-text-small">{measure}</span>
			</>
		);
	};
	return (
		<ListView
			title={t("Web Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("Name") },
				{
					key: "IP",
					label: t("IP Address"),
					center: true,
					format: (v) => nat[v] ?? v,
				},
				{ key: "U_DISK", label: t("Disk"), center: true, format: usage },
				{ key: "U_BANDWIDTH", label: t("Bandwidth"), center: true, format: usage },
				{
					key: "SSL",
					label: t("SSL"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "STATS",
					label: t("Statistics"),
					center: true,
					format: (v, row) =>
						statusIcon(
							v && v !== "no" ? "yes" : "no",
							row.SUSPENDED === "yes",
							t("Enabled"),
							t("Disabled"),
						),
				},
			]}
			rowHref={(key) => `/edit/web?domain=${encodeURIComponent(key)}`}
			sub={(key, row) => {
				const aliases = String(row.ALIAS ?? "")
					.split(",")
					.map((a) => a.trim())
					.filter((a) => a && a !== `www.${key}`);
				if (!aliases.length) return null;
				return <p className="hint u-max-width300 u-text-truncate">({aliases.join(", ")})</p>;
			}}
			rowActions={(key, row) => [
				...(row.STATS && row.STATS !== "no"
					? [
							<a
								className="units-table-row-action-link"
								href={`${row.SSL === "yes" ? "https" : "http"}://${key}/vstats/`}
								target="_blank"
								rel="noopener"
								title={t("Statistics")}
							>
								<i className="fas fa-chart-bar icon-maroon"></i>
								<span className="u-hide-desktop">{t("Statistics")}</span>
							</a>,
						]
					: []),
				<a
					className="units-table-row-action-link"
					href={`http://${key}/`}
					target="_blank"
					rel="noopener"
					title={t("Visit")}
				>
					<i className="fas fa-square-up-right icon-lightblue"></i>
					<span className="u-hide-desktop">{t("Visit")}</span>
				</a>,
				...(row.SUSPENDED === "yes"
					? []
					: [
							<RowAction
								href={`/edit/web?domain=${encodeURIComponent(key)}`}
								title={t("Edit Domain")}
								icon="fa-pencil icon-orange"
							/>,
						]),
				<form action={toggleWebDomainAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={key} />
					<input
						type="hidden"
						name="op"
						value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
					/>
					<RowActionButton
						title={row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
						icon={row.SUSPENDED === "yes" ? "fa-play icon-green" : "fa-pause icon-highlight"}
					/>
				</form>,
				<RowAction
					href={`/delete/web?domain=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("web domain"), plural: t("web domains") }}
			checkboxName="domain[]"
			bulkAction={bulkWebAction}
			bulkToken={token}
			bulkOptions={[
				...(isAdmin ? [{ value: "rebuild", label: t("Rebuild") }] : []),
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				...(nginxCache ? [{ value: "purge", label: t("Purge Nginx Cache") }] : []),
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/web"
			sortOptions={[
				{
					key: "bandwidth",
					label: t("Bandwidth"),
					value: (_k, row) => Number(row.U_BANDWIDTH ?? 0),
					dir: "desc",
				},
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{
					key: "disk",
					label: t("Disk"),
					value: (_k, row) => Number(row.U_DISK ?? 0),
					dir: "desc",
				},
				{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
				{ key: "ip", label: t("IP Address"), value: sortByIp, dir: "asc" },
			]}
			containerId="list-web"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/add/web">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Web Domain")}
			</Link>
		</ListView>
	);
}
