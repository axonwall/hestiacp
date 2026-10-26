import Link from "next/link";
import { humanizeUsage } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView, sortByDate, sortByName, statusIcon } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkMailAction, toggleMailDomainAction } from "./actions";

export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	const sys = session.data as unknown as Record<string, string | undefined>;
	const webmailAlias = sys.WEBMAIL_ALIAS || "webmail";
	const webmailSystem = Boolean(sys.WEBMAIL_SYSTEM);
	const { sort } = await searchParams;
	const result = await loadRows(() => hestia.listMailDomains(user));
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
			title={t("Mail Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("Name") },
				{ key: "ACCOUNTS", label: t("Accounts"), center: true },
				{ key: "U_DISK", label: t("Disk"), center: true, format: usage },
				{
					key: "ANTIVIRUS",
					label: t("Anti-Virus"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "ANTISPAM",
					label: t("Spam Filter"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "DKIM",
					label: t("DKIM"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "SSL",
					label: t("SSL"),
					center: true,
					format: (v, row) => statusIcon(v, row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
			]}
			rowHref={(key) => `/list/mail/accounts?domain=${encodeURIComponent(key)}`}
			rowActions={(key, row) => [
				<RowAction
					href={`/list/mail/accounts?domain=${encodeURIComponent(key)}`}
					title={t("Mail Accounts")}
					icon="fa-users icon-blue"
				/>,
				<RowAction
					href={`/list/dns/records?domain=${encodeURIComponent(key)}`}
					title={t("DNS Records")}
					icon="fa-book-atlas icon-blue"
				/>,
				...(row.SUSPENDED === "yes"
					? []
					: [
							<RowAction
								href={`/add/mail/account?domain=${encodeURIComponent(key)}`}
								title={t("Add Mail Account")}
								icon="fa-circle-plus icon-green"
							/>,
						]),
				...(webmailSystem && row.WEBMAIL && row.SUSPENDED !== "yes"
					? [
							<a
								className="units-table-row-action-link"
								href={`https://${webmailAlias}.${key}/`}
								target="_blank"
								rel="noopener"
								title={t("Open Webmail")}
							>
								<i className="fas fa-paper-plane icon-lightblue"></i>
								<span className="u-hide-desktop">{t("Open Webmail")}</span>
							</a>,
						]
					: []),
				<RowAction
					href={`/edit/mail?domain=${encodeURIComponent(key)}`}
					title={t("Edit Mail Domain")}
					icon="fa-pencil icon-orange"
				/>,
				<form action={toggleMailDomainAction} style={{ display: "inline" }}>
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
					href={`/delete/mail?domain=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("mail domain"), plural: t("mail domains") }}
			checkboxName="domain[]"
			bulkAction={bulkMailAction}
			bulkToken={token}
			bulkOptions={[
				...(isAdmin ? [{ value: "rebuild", label: t("Rebuild All") }] : []),
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase="/list/mail"
			sortOptions={[
				{
					key: "accounts",
					label: t("Accounts"),
					value: (_k, row) => Number(row.ACCOUNTS ?? 0),
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
			]}
			containerId="list-mail"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/add/mail">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Mail Domain")}
			</Link>
		</ListView>
	);
}
