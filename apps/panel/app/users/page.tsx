import Link from "next/link";
import { humanizeUsage } from "@hestiacp/lib";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { ListView, sortByDate, sortByName } from "@/components/ListView";
import { redirect } from "next/navigation";
import { getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { loginAsAction } from "@/app/session/actions";
import { bulkUsersAction, toggleSuspendAction } from "./actions";

/** PHP's "used / limit" usage cell, 1 decimal like list_user.php. */
function fmtUsage(used: string, limit: string): string {
	const u = humanizeUsage(used, 1);
	const l = humanizeUsage(limit, 1);
	const a = [u.size, u.measure].filter(Boolean).join(" ");
	const b = [l.size, l.measure].filter(Boolean).join(" ");
	return `${a} / ${b}`;
}

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; sort?: string }>;
}) {
	const session = await requireSession();
	// While impersonating, the panel's home is the looked user's account —
	// the list belongs to the admin's un-impersonated view (as in PHP).
	if (session.data.look) {
		redirect(`/users/${encodeURIComponent(String(session.data.look))}`);
	}
	const query = await searchParams;
	const t = await getT();
	const isAdmin = session.data.userContext === "admin";
	const token = String(session.data.token ?? "");
	const self = String(session.data.user ?? "");
	const result = await loadRows(() => hestia.listUsers());
	return (
		<div>
			{query.error ? <p className="error">{query.error}</p> : null}
			<ListView
				title={t("Users")}
				result={result}
				columns={[
					{
						key: "USER",
						label: t("Name"),
						format: (_v, row, k) => `${k} (${row.NAME ?? ""})`,
					},
					{
						key: "PACKAGE",
						label: t("Package"),
						center: true,
						heading: true,
						format: (v) =>
							v === "system" ? v : <Link href={`/packages/${encodeURIComponent(v)}`}>{v}</Link>,
					},
					{ key: "IP_OWNED", label: t("IPs"), center: true },
					{
						key: "U_DISK",
						label: t("Disk"),
						center: true,
						format: (v, row) => fmtUsage(v, row.DISK_QUOTA ?? ""),
					},
					{
						key: "U_BANDWIDTH",
						label: t("Bandwidth"),
						center: true,
						format: (v, row) => fmtUsage(v, row.BANDWIDTH ?? ""),
					},
					{
						key: "U_WEB_DOMAINS",
						label: t("Web Domains"),
						center: true,
						format: (v) => <span className="units-table-badge">{v}</span>,
					},
					{
						key: "U_DNS_DOMAINS",
						label: t("DNS Zones"),
						center: true,
						format: (v) => <span className="units-table-badge">{v}</span>,
					},
					{
						key: "U_MAIL_DOMAINS",
						label: t("Mail Domains"),
						center: true,
						format: (v) => <span className="units-table-badge">{v}</span>,
					},
					{
						key: "U_DATABASES",
						label: t("Databases"),
						center: true,
						format: (v) => <span className="units-table-badge">{v}</span>,
					},
					{
						key: "U_BACKUPS",
						label: t("Backups"),
						center: true,
						format: (v) => <span className="units-table-badge">{v}</span>,
					},
				]}
				sub={(_k, row) => (
					<>
						<br />
						<span title={row.CONTACT ?? ""}>{row.CONTACT ?? ""}</span>
					</>
				)}
				rowHref={(key) => `/users/${encodeURIComponent(key)}`}
				rowActions={
					isAdmin
						? (key, row) => [
								...(key === self
									? []
									: [
											<form key="login-as" action={loginAsAction} style={{ display: "inline" }}>
												<input type="hidden" name="user" value={key} />
												<input type="hidden" name="token" value={token} />
												<RowActionButton
													title={t("Log In As")}
													icon="fa-right-to-bracket icon-green"
												/>
											</form>,
										]),
								<RowAction
									key="edit"
									href={`/users/${encodeURIComponent(key)}`}
									title={t("Edit User")}
									icon="fa-pencil icon-orange"
								/>,
								...(key === self
									? []
									: [
											<form key="toggle" action={toggleSuspendAction} style={{ display: "inline" }}>
												<input type="hidden" name="user" value={key} />
												<input type="hidden" name="token" value={token} />
												<input
													type="hidden"
													name="op"
													value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
												/>
												<RowActionButton
													title={row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
													icon={
														row.SUSPENDED === "yes"
															? "fa-play icon-green"
															: "fa-pause icon-highlight"
													}
												/>
											</form>,
											<RowAction
												key="delete"
												href={`/users/${encodeURIComponent(key)}/delete`}
												title={t("Delete")}
												icon="fa-trash icon-red"
											/>,
										]),
							]
						: undefined
				}
				footer={{ singular: t("user account"), plural: t("user accounts") }}
				checkboxName={isAdmin ? "user[]" : undefined}
				bulkAction={isAdmin ? bulkUsersAction : undefined}
				bulkToken={token}
				bulkOptions={[
					{ value: "rebuild", label: t("Rebuild All") },
					{ value: "rebuild user", label: t("Rebuild User Profile") },
					{ value: "rebuild web", label: t("Rebuild Web Domains") },
					{ value: "rebuild dns", label: t("Rebuild DNS Zones") },
					{ value: "rebuild mail", label: t("Rebuild Mail Domains") },
					{ value: "rebuild db", label: t("Rebuild Databases") },
					{ value: "rebuild cron", label: t("Rebuild Cron Jobs") },
					{ value: "update counters", label: t("Update Usage Counters") },
					{ value: "suspend", label: t("Suspend") },
					{ value: "unsuspend", label: t("Unsuspend") },
					{ value: "delete", label: t("Delete") },
				]}
				sort={query.sort}
				sortBase="/users"
				sortOptions={[
					{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
					{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
					{
						key: "package",
						label: t("Package"),
						value: (_k, row) => (row.PACKAGE ?? "").toLowerCase(),
						dir: "asc",
					},
					{
						key: "bandwidth",
						label: t("Bandwidth"),
						value: (_k, row) => Number(row.U_BANDWIDTH ?? 0),
						dir: "desc",
					},
					{
						key: "disk",
						label: t("Disk"),
						value: (_k, row) => Number(row.U_DISK ?? 0),
						dir: "desc",
					},
				]}
				containerId="list-user"
				chrome={{
					sortBy: t("Sort by"),
					search: t("Search"),
					applyToSelected: t("Apply to selected"),
					select: t("Select"),
					selectAll: t("Select all"),
				}}
			>
				{isAdmin ? (
					<>
						<Link className="button button-secondary" href="/add/user">
							<i className="fas fa-circle-plus icon-green"></i>
							{t("Add User")}
						</Link>
						<Link className="button button-secondary" href="/packages">
							<i className="fas fa-box-open icon-orange"></i>
							{t("Packages")}
						</Link>
					</>
				) : null}
			</ListView>
		</div>
	);
}
