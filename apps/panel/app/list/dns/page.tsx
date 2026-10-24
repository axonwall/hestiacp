import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { toggleDnsDomainAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
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
			rowActions={(key, row) => (<>
				<Link href={`/edit/dns?domain=${encodeURIComponent(key)}`}>{t("Edit")}</Link>
				{" "}
				<form action={toggleDnsDomainAction} style={{ display: "inline" }}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="domain" value={key} />
										<input type="hidden" name="op" value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"} />
										<button type="submit" className="link-button">{row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}</button>
									</form>
				{" "}
				<Link href={`/delete/dns?domain=${encodeURIComponent(key)}`}>{t("Delete")}</Link>
			</>)}
		>
			<Link className="button button-secondary" href="/add/dns"><i className="fas fa-circle-plus icon-green"></i>{t("Add DNS Zone")}</Link>
		</ListView>
	);
}
