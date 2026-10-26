import Link from "next/link";
import { humanizeUsage } from "@hestiacp/lib";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { ListView, sortByDate, sortByName } from "@/components/ListView";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { bulkPackagesAction, copyPackageAction } from "./actions";

/** PHP's quota cell: any alphabetic value (e.g. "unlimited") renders as infinity. */
function fmtQuota(value: string): string {
	if (/[a-z]/i.test(value)) return "∞";
	const u = humanizeUsage(value);
	return [u.size, u.measure].filter(Boolean).join(" ");
}

function fmtBandwidth(value: string): string {
	const u = humanizeUsage(value);
	return [u.size, u.measure].filter(Boolean).join(" ");
}

/** PHP's count badge: "unlimited" renders as infinity, anything else as-is. */
function badge(value: string): React.ReactNode {
	return <span className="units-table-badge">{value === "unlimited" ? "∞" : value}</span>;
}

export default async function PackagesPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; sort?: string }>;
}) {
	const session = await requireAdmin();
	const query = await searchParams;
	const t = await getT();
	const token = String(session.data.token ?? "");
	const result = await loadRows(() => hestia.listUserPackages());
	return (
		<div>
			{query.error ? <p className="error">{query.error}</p> : null}
			<ListView
				title={t("Packages")}
				result={result}
				columns={[
					{
						key: "PACKAGE",
						label: t("Package"),
						format: (_v, _row, k) =>
							k === "system" ? k : <Link href={`/packages/${encodeURIComponent(k)}`}>{k}</Link>,
					},
					{
						key: "SHELL",
						label: t("Shell"),
						center: true,
						format: (v) =>
							v === "nologin" ? (
								<i
									className="fas fa-circle-minus icon-large"
									title={`${t("SSH Access")}: ${v}`}
								></i>
							) : (
								<i className="fas fa-circle-check icon-green icon-large"></i>
							),
					},
					{ key: "DISK_QUOTA", label: t("Quota"), center: true, format: fmtQuota },
					{ key: "BANDWIDTH", label: t("Bandwidth"), center: true, format: fmtBandwidth },
					{
						key: "WEB_DOMAINS",
						label: t("Web Domains"),
						center: true,
						format: badge,
					},
					{
						key: "WEB_ALIASES",
						label: t("Web Aliases"),
						center: true,
						format: badge,
					},
					{
						key: "DNS_DOMAINS",
						label: t("DNS Zones"),
						center: true,
						format: badge,
					},
					{
						key: "DNS_RECORDS",
						label: t("DNS Records"),
						center: true,
						format: badge,
					},
					{
						key: "MAIL_DOMAINS",
						label: t("Mail Domains"),
						center: true,
						format: badge,
					},
					{
						key: "MAIL_ACCOUNTS",
						label: t("Mail Accounts"),
						center: true,
						format: badge,
					},
					{
						key: "DATABASES",
						label: t("Databases"),
						center: true,
						format: badge,
					},
					{
						key: "CRON_JOBS",
						label: t("Cron Jobs"),
						center: true,
						format: badge,
					},
					{
						key: "BACKUPS",
						label: t("Backups"),
						center: true,
						format: badge,
					},
				]}
				rowHref={(key) => `/packages/${encodeURIComponent(key)}`}
				rowActions={(key) => [
					...(key === "system"
						? []
						: [
								<RowAction
									key="edit"
									href={`/packages/${encodeURIComponent(key)}`}
									title={t("Edit Package")}
									icon="fa-pencil icon-orange"
								/>,
							]),
					<form key="duplicate" action={copyPackageAction} style={{ display: "inline" }}>
						<input type="hidden" name="package" value={key} />
						<input type="hidden" name="token" value={token} />
						<RowActionButton title={t("Duplicate")} icon="fa-clone icon-teal" />
					</form>,
					...(key === "system"
						? []
						: [
								<RowAction
									key="delete"
									href={`/packages/${encodeURIComponent(key)}/delete`}
									title={t("Delete")}
									icon="fa-trash icon-red"
								/>,
							]),
				]}
				footer={{ singular: t("package"), plural: t("packages") }}
				checkboxName="package[]"
				bulkAction={bulkPackagesAction}
				bulkToken={token}
				bulkOptions={[{ value: "delete", label: t("Delete") }]}
				sort={query.sort}
				sortBase="/packages"
				sortOptions={[
					{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
					{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
				]}
				containerId="list-package"
				search={false}
				chrome={{
					sortBy: t("Sort by"),
					search: t("Search"),
					applyToSelected: t("Apply to selected"),
					select: t("Select"),
					selectAll: t("Select all"),
				}}
			>
				<Link className="button button-secondary" href="/list/user">
					<i className="fas fa-arrow-left icon-blue"></i>
					{t("Back")}
				</Link>
				<Link className="button button-secondary" href="/add/package">
					<i className="fas fa-circle-plus icon-green"></i>
					{t("Add Package")}
				</Link>
			</ListView>
		</div>
	);
}
