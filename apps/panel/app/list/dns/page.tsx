import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listDnsDomains(user));
	return (
		<ListView
			title={t("DNS Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("DNS Domains") },
				{ key: "SOA", label: t("SOA") },
				{ key: "RECORDS", label: t("Records") },
				{ key: "DNSSEC", label: t("DNSSEC") },
				{ key: "SUSPENDED", label: t("Suspended") },
				{ key: "DATE", label: t("Date") }
			]}
			rowHref={(key) => `/list/dns/records?domain=${encodeURIComponent(key)}`}
		></ListView>
	);
}
