import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import Link from "next/link";
import { ListView, sortByDate, sortByName } from "@/components/ListView";
import { RowAction } from "@/components/RowAction";
import { bulkDnsRecordAction } from "./actions";

/** DNS records of one domain (/list/dns/ → click a domain). */
export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; sort?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const token = String(session.data.token ?? "");
	const { domain, sort } = await searchParams;
	if (!domain) {
		return (
			<div className="card">
				<h1>{t("DNS Records")}</h1>
				<p>
					<a href="/list/dns">{t("Back")}</a> — pick a domain first.
				</p>
			</div>
		);
	}
	const result = await loadRows(() => hestia.listDnsRecords(user, domain));
	return (
		<ListView
			title={`${t("DNS Records")} — ${domain}`}
			result={result}
			columns={[
				{
					key: "RECORD",
					label: t("Record"),
					// PHP truncates the heading to 40 chars + "...".
					format: (v) => (v.length > 40 ? `${v.slice(0, 40)}...` : v),
				},
				{ key: "TYPE", label: t("Type"), center: true },
				{ key: "PRIORITY", label: t("Priority"), center: true },
				{
					key: "TTL",
					label: "TTL",
					center: true,
					// PHP renders "Default" for an empty TTL.
					format: (v) => v || t("Default"),
				},
				{ key: "VALUE", label: t("IP or Value") },
			]}
			// PHP links the heading to the edit form, except on
			// suspended rows, which render as plain text.
			rowHref={(key, row) =>
				row.SUSPENDED === "yes"
					? null
					: `/edit/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(key)}`
			}
			rowActions={(key, row) => [
				...(row.SUSPENDED === "yes"
					? []
					: [
							<RowAction
								href={`/edit/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(key)}`}
								title={t("Edit DNS Record")}
								icon="fa-pencil icon-orange"
							/>,
						]),
				<RowAction
					href={`/delete/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("DNS record"), plural: t("DNS records") }}
			checkboxName="record[]"
			bulkAction={bulkDnsRecordAction}
			bulkToken={token}
			bulkExtra={{ domain }}
			bulkOptions={[
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase={`/list/dns/records?domain=${encodeURIComponent(domain)}`}
			sortOptions={[
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{
					key: "value",
					label: t("IP or Value"),
					value: (_k, row) => row.VALUE ?? "",
					dir: "asc",
				},
				{
					key: "record",
					label: t("Record"),
					value: (_k, row) => row.RECORD ?? _k,
					dir: "asc",
				},
				{
					key: "ttl",
					label: "TTL",
					value: (_k, row) => Number(row.TTL ?? 0),
					dir: "asc",
				},
				{
					key: "type",
					label: t("Type"),
					value: (_k, row) => row.TYPE ?? "",
					dir: "asc",
				},
			]}
			containerId="list-dns-records"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/dns">
				{t("Back")}
			</Link>
			<Link
				className="button button-secondary"
				href={`/edit/dns?domain=${encodeURIComponent(domain)}`}
			>
				{t("Edit DNS Domain")}
			</Link>
		</ListView>
	);
}
