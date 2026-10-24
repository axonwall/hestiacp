import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import Link from "next/link";
import { ListView } from "@/components/ListView";
import { toggleMailAccountAction } from "./actions";

/** Mail accounts of one domain (/list/mail/ → click a domain). */
export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const { domain } = await searchParams;
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
	return (
		<ListView
			title={`${t("Mail Accounts")} — ${domain}`}
			result={result}
			columns={[
				{ key: "ACCOUNT", label: t("Account") },
				{ key: "QUOTA", label: t("Quota") },
				{
					key: "U_DISK",
					label: t("Disk"),
					format: (v) => `${v} MB`,
				},
				{ key: "AUTOREPLY", label: t("Autoreply") },
				{ key: "SUSPENDED", label: t("Suspended") },
			]}
			rowActions={(key, row) => (
				<>
					<Link
						href={`/edit/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(key)}`}
					>
						{t("Edit")}
					</Link>{" "}
					<form action={toggleMailAccountAction} style={{ display: "inline" }}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="domain" value={domain} />
						<input type="hidden" name="account" value={key} />
						<input
							type="hidden"
							name="op"
							value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
						/>
						<button type="submit" className="link-button">
							{row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
						</button>
					</form>{" "}
					<Link
						href={`/delete/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(key)}`}
					>
						{t("Delete")}
					</Link>
				</>
			)}
		>
			<p>
				<a href="/list/mail">{t("Back")}</a> ·{" "}
				<Link
					className="button"
					href={`/add/mail/account?domain=${encodeURIComponent(domain)}`}
				>
					{t("Add Mail Account")}
				</Link>
			</p>
		</ListView>
	);
}
