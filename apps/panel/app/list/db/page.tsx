import Link from "next/link";
import { headers } from "next/headers";
import { humanizeUsage } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView, sortByDate, sortByName } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkDbAction, toggleDatabaseAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	const sys = session.data as unknown as Record<string, string | undefined>;
	const { sort } = await searchParams;
	const result = await loadRows(() => hestia.listDatabases(user));
	// PHP toolbar links use the request host (//host/phpmyadmin/ or
	// //host/<DB_PMA_ALIAS>/), with the button-suspended class when
	// the panel is reached by IP instead of hostname.
	const host = (await headers()).get("host") ?? "";
	const hostNoPort = host.replace(/:\d+$/, "");
	const ipUsed = /^(?:\d{1,3}\.){3}\d{1,3}$/.test(hostNoPort) || hostNoPort.startsWith("[");
	const pma = `//${host}/${sys.DB_PMA_ALIAS || "phpmyadmin"}/`;
	const pga = `//${host}/${sys.DB_PGA_ALIAS || "phppgadmin"}/`;
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
			title={t("Databases")}
			result={result}
			columns={[
				{ key: "DATABASE", label: t("Name") },
				{ key: "U_DISK", label: t("Disk"), center: true, format: usage },
				{ key: "TYPE", label: t("Type"), center: true },
				{ key: "DBUSER", label: t("Username"), center: true },
				{ key: "HOST", label: t("Hostname"), center: true },
				{ key: "CHARSET", label: t("Charset"), center: true },
			]}
			// PHP links the heading to the edit form, except on
			// suspended rows, which render as plain text.
			rowHref={(key, row) =>
				row.SUSPENDED === "yes" ? null : `/edit/db?database=${encodeURIComponent(key)}`
			}
			rowActions={(key, row) => [
				...(row.SUSPENDED === "yes"
					? []
					: [
							<RowAction
								key="edit"
								href={`/edit/db?database=${encodeURIComponent(key)}`}
								title={t("Edit Database")}
								icon="fa-pencil icon-orange"
							/>,
						]),
				<form key="toggle" action={toggleDatabaseAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="database" value={key} />
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
					href={`/delete/db?database=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("database"), plural: t("databases") }}
			checkboxName="database[]"
			bulkAction={bulkDbAction}
			bulkToken={token}
			bulkOptions={[
				...(isAdmin
					? [
							{ value: "rebuild", label: t("Rebuild All") },
							{ value: "suspend", label: t("Suspend All") },
							{ value: "unsuspend", label: t("Unsuspend All") },
						]
					: []),
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/db"
			sortOptions={[
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{
					key: "charset",
					label: t("Charset"),
					value: (_k, row) => row.CHARSET ?? "",
					dir: "asc",
				},
				{
					key: "disk",
					label: t("Disk"),
					value: (_k, row) => Number(row.U_DISK ?? 0),
					dir: "desc",
				},
				{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
				{
					key: "host",
					label: t("Hostname"),
					value: (_k, row) => row.HOST ?? "",
					dir: "asc",
				},
				{
					key: "username",
					label: t("Username"),
					value: (_k, row) => row.DBUSER ?? "",
					dir: "asc",
				},
			]}
			containerId="list-db"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/add/db">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Database")}
			</Link>
			{(sys.DB_SYSTEM ?? "").split(",").includes("mysql") ? (
				<a
					className={`button button-secondary${ipUsed ? " button-suspended" : ""}`}
					href={pma}
					target="_blank"
					rel="noopener"
				>
					<i className="fas fa-database icon-orange"></i>
					phpMyAdmin
				</a>
			) : null}
			{(sys.DB_SYSTEM ?? "").split(",").includes("pgsql") ? (
				<a
					className={`button button-secondary${ipUsed ? " button-suspended" : ""}`}
					href={pga}
					target="_blank"
					rel="noopener"
				>
					<i className="fas fa-database icon-orange"></i>
					phpPgAdmin
				</a>
			) : null}
			{ipUsed ? (
				<a
					href="https://hestiacp.com/docs/server-administration/databases.html#why-i-can-t-use-http-ip-phpmyadmin"
					target="_blank"
					rel="noopener"
				>
					<i className="fas fa-circle-question"></i>
				</a>
			) : null}
		</ListView>
	);
}
