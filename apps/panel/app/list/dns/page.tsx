import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import {
	ListView,
	sortByDate,
	sortByExpire,
	sortByIp,
	sortByName,
	sortByRecords,
	statusIcon,
} from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkDnsAction, toggleDnsDomainAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	const { sort } = await searchParams;
	const result = await loadRows(() => hestia.listDnsDomains(user));
	return (
		<ListView
			title={t("DNS Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("Name") },
				{ key: "RECORDS", label: t("Records"), center: true },
				{
					key: "TPL",
					label: t("Template"),
					center: true,
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
				{ key: "TTL", label: t("TTL"), center: true },
				{ key: "SOA", label: t("SOA"), center: true },
				{
					key: "DNSSEC",
					label: t("DNSSEC"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "EXP",
					label: t("Expiration Date"),
					center: true,
					format: (v) => (
						<time className="u-text-bold" dateTime={v}>
							{v}
						</time>
					),
				},
			]}
			rowHref={(key) => `/list/dns/records?domain=${encodeURIComponent(key)}`}
			sub={(_key, row) =>
				row.SRC ? (
					<>
						<br />⇢ <span className="u-text-small">{row.SRC}</span>
					</>
				) : null
			}
			rowActions={(key, row) => [
				...(row.SUSPENDED === "yes"
					? []
					: [
							<RowAction
								key="edit"
								href={`/edit/dns?domain=${encodeURIComponent(key)}`}
								title={t("Edit DNS Domain")}
								icon="fa-pencil icon-orange"
							/>,
						]),
				...(row.DNSSEC === "yes"
					? [
							<RowAction
								key="dnssec"
								href={`/list/dns/dnssec?domain=${encodeURIComponent(key)}`}
								title={t("View Public DNSSEC Key")}
								icon="fa-key icon-orange"
							/>,
						]
					: []),
				<RowAction
					key="records"
					href={`/list/dns/records?domain=${encodeURIComponent(key)}`}
					title={t("DNS Records")}
					icon="fa-list icon-lightblue"
				/>,
				<form key="toggle" action={toggleDnsDomainAction} style={{ display: "inline" }}>
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
					key="delete"
					href={`/delete/dns?domain=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("DNS zone"), plural: t("DNS zones") }}
			checkboxName="domain[]"
			bulkAction={bulkDnsAction}
			bulkToken={token}
			bulkOptions={[
				...(isAdmin ? [{ value: "rebuild", label: t("Rebuild") }] : []),
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/dns"
			sortOptions={[
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{ key: "expire", label: t("Expire"), value: sortByExpire, dir: "desc" },
				{ key: "ip", label: t("IP Address"), value: sortByIp, dir: "asc" },
				{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
				{ key: "records", label: t("Records"), value: sortByRecords, dir: "desc" },
			]}
			containerId="list-dns"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/add/dns">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add DNS Domain")}
			</Link>
		</ListView>
	);
}
