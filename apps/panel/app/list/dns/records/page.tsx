import {
	effectiveUser,
	getT,
	hestia,
	loadRows,
	requireSession,
} from "@/lib/panel";
import Link from "next/link";
import { ListView } from "@/components/ListView";

/** DNS records of one domain (/list/dns/ → click a domain). */
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
				<h1>{t("DNS Records")}</h1>
				<p>
					<a href="/list/dns">{t("Back")}</a> — pick a domain first.
				</p>
			</div>
		);
	}
	const result = await loadRows(() => hestia.listDnsRecords(user, domain));
	return (
		<ListView
			title={`${t("DNS Records")} — ${domain}`}
			result={result}
			columns={[
				{ key: "RECORD", label: t("Record") },
				{ key: "TYPE", label: t("Type") },
				{ key: "PRIORITY", label: t("Priority") },
				{ key: "VALUE", label: t("Value") },
				{ key: "TTL", label: "TTL" },
				{ key: "SUSPENDED", label: t("Suspended") },
			]}
			rowActions={(key) => (
				<>
					<Link
						href={`/edit/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(key)}`}
					>
						{t("Edit")}
					</Link>{" "}
					<Link
						href={`/delete/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(key)}`}
					>
						{t("Delete")}
					</Link>
				</>
			)}
		>
			<p>
				<a href="/list/dns">{t("Back")}</a> ·{" "}
				<Link href={`/edit/dns?domain=${encodeURIComponent(domain)}`}>
					{t("Edit DNS Zone")}
				</Link>
			</p>
		</ListView>
	);
}
