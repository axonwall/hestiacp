import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView, sortByIp } from "@/components/ListView";
import { RowAction } from "@/components/RowAction";
import { bulkIpAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysIps());
	const token = String(session.data.token ?? "");
	const { sort } = await searchParams;
	return (
		<ListView
			title={t("IP Addresses")}
			result={result}
			columns={[
				{
					key: "IP",
					label: t("IP Address"),
					format: (v, row) => (row.NAT ? `${v} → ${row.NAT}` : v),
				},
				{ key: "NETMASK", label: t("Netmask") },
				{ key: "INTERFACE", label: t("Interface") },
				{ key: "STATUS", label: t("Status"), format: (v) => t(v) },
				{
					key: "U_WEB_DOMAINS",
					label: t("Domains"),
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
				{ key: "OWNER", label: t("Owner") },
			]}
			rowHref={(key) => `/edit/ip?ip=${encodeURIComponent(key)}`}
			rowActions={(key) => [
				<RowAction
					key="edit"
					href={`/edit/ip?ip=${encodeURIComponent(key)}`}
					title={t("Edit")}
					icon="fa-pencil icon-orange"
				/>,
				<RowAction
					key="delete"
					href={`/delete/ip?ip=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("IP address"), plural: t("IP addresses") }}
			checkboxName="ip[]"
			bulkAction={bulkIpAction}
			bulkToken={token}
			bulkOptions={[
				{ value: "reread", label: t("Reread IP") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/ip"
			sortOptions={[
				{
					key: "date",
					label: t("Date"),
					value: (_k, row) => row.DATE ?? "",
					dir: "desc",
				},
				{ key: "ip", label: t("IP Address"), value: sortByIp, dir: "asc" },
				{
					key: "netmask",
					label: t("Netmask"),
					value: (_k, row) => row.NETMASK ?? "",
					dir: "asc",
				},
				{
					key: "interface",
					label: t("Interface"),
					value: (_k, row) => row.INTERFACE ?? "",
					dir: "asc",
				},
				{
					key: "domains",
					label: t("Domains"),
					value: (_k, row) => Number(row.U_WEB_DOMAINS ?? 0) || 0,
					dir: "asc",
				},
				{
					key: "owner",
					label: t("Owner"),
					value: (_k, row) => row.OWNER ?? "",
					dir: "asc",
				},
			]}
			containerId="list-ip"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/edit/server">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<Link className="button button-secondary" href="/add/ip">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add IP Address")}
			</Link>
		</ListView>
	);
}
