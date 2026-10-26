import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { humanizeUsage } from "@hestiacp/lib";
import Link from "next/link";
import { ListView, sortByDate, sortByName } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { bulkMailAccountAction, toggleMailAccountAction } from "./actions";

/** Presence icon (PHP list_mail_acc.php): set → check (green when
 * active), unset → plain minus; titles Enabled/Disabled. */
function presenceIcon(present: boolean, suspended: boolean, enabled: string, disabled: string) {
	return present ? (
		<i className={`fas fa-circle-check${suspended ? "" : " icon-green"}`} title={enabled}></i>
	) : (
		<i className="fas fa-circle-minus" title={disabled}></i>
	);
}

/** Mail accounts of one domain (/list/mail/ → click a domain). */
export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; sort?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const sys = session.data as unknown as Record<string, string | undefined>;
	const webmailAlias = sys.WEBMAIL_ALIAS || "webmail";
	const webmailSystem = Boolean(sys.WEBMAIL_SYSTEM);
	const { domain, sort } = await searchParams;
	if (!domain) {
		return (
			<div className="card">
				<h1>{t("Mail Accounts")}</h1>
				<p>
					<a href="/list/mail">{t("Back")}</a> — pick a domain first.
				</p>
			</div>
		);
	}
	const token = String(session.data.token ?? "");
	const result = await loadRows(() => hestia.listMailAccounts(user, domain));
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
			title={`${t("Mail Accounts")} — ${domain}`}
			result={result}
			columns={[
				{ key: "ACCOUNT", label: t("Name") },
				{ key: "U_DISK", label: t("Disk"), center: true, format: usage },
				{ key: "QUOTA", label: t("Quota"), center: true, format: usage },
				{
					key: "ALIAS",
					label: t("Aliases"),
					center: true,
					format: (v, row) =>
						presenceIcon(Boolean(v), row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "FWD",
					label: t("Forwarding"),
					center: true,
					format: (v, row) =>
						presenceIcon(Boolean(v), row.SUSPENDED === "yes", t("Enabled"), t("Disabled")),
				},
				{
					key: "AUTOREPLY",
					label: t("Auto Reply"),
					center: true,
					format: (v, row) =>
						presenceIcon(
							v !== "no" && Boolean(v),
							row.SUSPENDED === "yes",
							t("Enabled"),
							t("Disabled"),
						),
				},
			]}
			rowActions={(key, row) => [
				...(webmailSystem && row.WEBMAIL && row.SUSPENDED !== "yes"
					? [
							<a
								key="webmail"
								className="units-table-row-action-link"
								href={`http://${webmailAlias}.${domain}/?_user=${encodeURIComponent(key)}@${encodeURIComponent(domain)}`}
								target="_blank"
								rel="noopener"
								title={t("Open Webmail")}
							>
								<i className="fas fa-envelope-open-text icon-maroon"></i>
								<span className="u-hide-desktop">{t("Open Webmail")}</span>
							</a>,
						]
					: []),
				<RowAction
					key="edit"
					href={`/edit/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(key)}`}
					title={t("Edit Mail Account")}
					icon="fa-pencil icon-orange"
				/>,
				<form key="toggle" action={toggleMailAccountAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<input type="hidden" name="account" value={key} />
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
					href={`/delete/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(key)}`}
					title={t("Delete")}
					icon="fa-trash icon-red"
				/>,
			]}
			footer={{ singular: t("mail account"), plural: t("mail accounts") }}
			checkboxName="account[]"
			bulkAction={bulkMailAccountAction}
			bulkToken={token}
			bulkExtra={{ domain }}
			bulkOptions={[
				{ value: "suspend", label: t("Suspend") },
				{ value: "unsuspend", label: t("Unsuspend") },
				{ value: "delete", label: t("Delete") },
			]}
			sort={sort}
			sortBase={`/list/mail/accounts?domain=${encodeURIComponent(domain)}`}
			sortOptions={[
				{ key: "date", label: t("Date"), value: sortByDate, dir: "desc" },
				{
					key: "disk",
					label: t("Disk"),
					value: (_k, row) => Number(row.U_DISK ?? 0),
					dir: "desc",
				},
				{ key: "name", label: t("Name"), value: sortByName, dir: "asc" },
				{
					key: "quota",
					label: t("Quota"),
					value: (_k, row) => (row.QUOTA === "unlimited" ? Infinity : Number(row.QUOTA ?? 0)),
					dir: "desc",
				},
			]}
			containerId="list-mail-accounts"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/mail">
				{t("Back")}
			</Link>
			<Link
				className="button button-secondary"
				href={`/add/mail/account?domain=${encodeURIComponent(domain)}`}
			>
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Mail Account")}
			</Link>
			<Link
				className="button button-secondary"
				href={`/edit/mail?domain=${encodeURIComponent(domain)}`}
			>
				{t("Edit Mail Domain")}
			</Link>
		</ListView>
	);
}
