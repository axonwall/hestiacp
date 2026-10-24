import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { toggleMailDomainAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const result = await loadRows(() => hestia.listMailDomains(user));
	return (
		<ListView
			title={t("Mail Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("Mail Domains") },
				{ key: "ACCOUNTS", label: t("Accounts") },
				{ key: "ANTISPAM", label: t("Antispam") },
				{ key: "DKIM", label: t("DKIM") },
				{ key: "SSL", label: t("SSL") },
				{ key: "SUSPENDED", label: t("Suspended") }
			]}
			rowHref={(key) => `/list/mail/accounts?domain=${encodeURIComponent(key)}`}
			rowActions={(key, row) => (<>
				<Link href={`/edit/mail?domain=${encodeURIComponent(key)}`}>{t("Edit")}</Link>
				{" "}
				<form action={toggleMailDomainAction} style={{ display: "inline" }}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="domain" value={key} />
										<input type="hidden" name="op" value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"} />
										<button type="submit" className="link-button">{row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}</button>
									</form>
				{" "}
				<Link href={`/delete/mail?domain=${encodeURIComponent(key)}`}>{t("Delete")}</Link>
			</>)}
		>
			<Link className="button button-secondary" href="/add/mail"><i className="fas fa-circle-plus icon-green"></i>{t("Add Mail Domain")}</Link>
		</ListView>
	);
}
