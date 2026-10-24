import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import { ListView } from "@/components/ListView";

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
		>
			<p>
				<a href="/list/mail">{t("Back")}</a>
			</p>
		</ListView>
	);
}
