import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { deleteLogAction } from "./actions";

/**
 * Log (web/templates/pages/list_log.php): no checkbox, no row
 * actions, no sort, no search. First column is the LEVEL icon
 * (Info/Warning/Error), Date/Time as <time>, Category bold.
 * Admins may pass ?user=<name> (system → the system log); the Back
 * button follows PHP's three variants. Login History is omitted:
 * /list/log/auth does not exist in Next yet. Delete follows PHP's
 * gating: hidden for a protected root admin, otherwise shown for
 * admins or when POLICY_USER_DELETE_LOGS is not "no".
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ user?: string }> }) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const isAdmin = session.data.userContext === "admin";
	const paramUser = typeof query.user === "string" ? query.user : "";
	const viewUser = isAdmin && paramUser ? paramUser : effectiveUser(session);
	const result = await loadRows(() => hestia.listUserLog(viewUser));
	const token = String(session.data.token ?? "");
	const backHref =
		paramUser === "system" ? "/list/server" : isAdmin && paramUser ? "/list/user" : "/edit/user";
	const refreshHref = paramUser ? `/list/log?user=${encodeURIComponent(paramUser)}` : "/list/log";
	const hideDelete =
		isAdmin && !session.data.look && session.data.POLICY_SYSTEM_PROTECTED_ADMIN === "yes";
	const showDelete = !hideDelete && (isAdmin || session.data.POLICY_USER_DELETE_LOGS !== "no");
	const levelIcon = (level: string) => {
		const map: Record<string, [string, string]> = {
			Info: ["fa-info-circle icon-blue", t("Information")],
			Warning: ["fa-triangle-exclamation icon-orange", t("Warning")],
			Error: ["fa-circle-xmark icon-red", t("Error")],
		};
		const [icon, title] = map[level] ?? ["fa-info-circle icon-blue", level];
		return <i className={`fas ${icon}`} title={title}></i>;
	};
	return (
		<ListView
			title={t("Log")}
			result={result}
			columns={[
				{
					key: "LEVEL",
					label: "",
					center: true,
					format: (v) => levelIcon(v),
				},
				{
					key: "DATE",
					label: t("Date"),
					format: (v) => (
						<span className="u-text-bold">
							<time dateTime={v} className="u-text-no-wrap">
								{v}
							</time>
						</span>
					),
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
				{
					key: "CATEGORY",
					label: t("Category"),
					format: (v) => <span className="u-text-bold u-text-no-wrap">{v}</span>,
				},
				{ key: "MESSAGE", label: t("Message") },
			]}
			footer={{ singular: t("log record"), plural: t("log records") }}
			containerId="list-log"
			search={false}
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href={backHref}>
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<Link className="button button-secondary" href={refreshHref}>
				<i className="fas fa-arrow-rotate-right icon-green"></i>
				{t("Refresh")}
			</Link>
			{showDelete ? (
				<form action={deleteLogAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="user" value={viewUser} />
					<button type="submit" className="button button-secondary button-danger">
						<i className="fas fa-circle-xmark icon-red"></i>
						{t("Delete")}
					</button>
				</form>
			) : null}
		</ListView>
	);
}
