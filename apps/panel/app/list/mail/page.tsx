import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
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
		></ListView>
	);
}
