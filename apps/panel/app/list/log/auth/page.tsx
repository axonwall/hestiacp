import Link from "next/link";
import { redirect } from "next/navigation";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { deleteAuthLogAction } from "./actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** PHP translate_date: "d Mon YYYY" with the month name translated. */
function translateDate(date: string, t: (s: string) => string): string {
	const d = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(d.getTime())) return date;
	return `${d.getUTCDate()} ${t(MONTHS[d.getUTCMonth()])} ${d.getUTCFullYear()}`;
}

/**
 * Login history (web/templates/pages/list_log_auth.php): Status icon,
 * Date as <time>, Time as <time>, IP Address, Browser. No checkbox,
 * no sort, no search. Rows arrive oldest-first and are reversed.
 */
export default async function AuthLogPage({
	searchParams,
}: {
	searchParams: Promise<{ user?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const sys = session.data as unknown as Record<string, string | undefined>;
	const isAdmin = session.data.userContext === "admin";
	const look = String(session.data.look ?? "");
	// PHP's protected-admin gate: an admin viewing root's auth log
	// while protection is on is sent home.
	if (
		isAdmin &&
		look !== "" &&
		look === sys.ROOT_USER &&
		sys.POLICY_SYSTEM_PROTECTED_ADMIN === "yes"
	) {
		redirect("/");
	}
	const paramUser = typeof query.user === "string" ? query.user : "";
	const viewUser = isAdmin && paramUser && !look ? paramUser : effectiveUser(session);
	const result = await loadRows(async () => {
		const rows = await hestia.listUserAuthLog(viewUser);
		return Object.fromEntries(Object.entries(rows).reverse());
	});
	const token = String(session.data.token ?? "");
	const refreshHref = paramUser
		? `/list/log/auth?user=${encodeURIComponent(paramUser)}`
		: "/list/log/auth";
	const showDelete = isAdmin || session.data.POLICY_USER_DELETE_LOGS !== "no";
	return (
		<div>
			{query.error ? <p className="error">{query.error}</p> : null}
			<ListView
				title={t("Auth Log")}
				result={result}
				columns={[
					{
						key: "STATUS",
						label: t("Status"),
						center: true,
						format: (v) =>
							v === "success" ? (
								<i className="fas fa-circle-check icon-green" title={t("Success")}></i>
							) : (
								<i className="fas fa-circle-minus icon-red" title={t("Failed")}></i>
							),
					},
					{
						key: "DATE",
						label: t("Date"),
						heading: true,
						format: (v) => <time dateTime={v}>{translateDate(v, t)}</time>,
					},
					{
						key: "TIME",
						label: t("Time"),
						format: (v) => (
							<span className="u-text-bold">
								<time dateTime={v}>{v}</time>
							</span>
						),
					},
					{ key: "IP", label: t("IP Address") },
					{ key: "USER_AGENT", label: t("Browser") },
				]}
				footer={{ singular: t("log record"), plural: t("log records") }}
				containerId="list-log-auth"
				search={false}
				chrome={{
					sortBy: t("Sort by"),
					search: t("Search"),
					applyToSelected: t("Apply to selected"),
					select: t("Select"),
					selectAll: t("Select all"),
				}}
			>
				<Link className="button button-secondary" href="/list/log/">
					<i className="fas fa-arrow-left icon-blue"></i>
					{t("Back")}
				</Link>
				<Link className="button button-secondary" href={refreshHref}>
					<i className="fas fa-arrow-rotate-right icon-green"></i>
					{t("Refresh")}
				</Link>
				{showDelete ? (
					<form action={deleteAuthLogAction} style={{ display: "inline" }}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="user" value={viewUser} />
						<input type="hidden" name="back" value={refreshHref} />
						<button type="submit" className="button button-secondary button-danger">
							<i className="fas fa-circle-xmark icon-red"></i>
							{t("Delete")}
						</button>
					</form>
				) : null}
			</ListView>
		</div>
	);
}
