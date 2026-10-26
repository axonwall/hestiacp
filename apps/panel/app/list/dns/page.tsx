import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
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
				{ key: "DATE", label: t("Date") },
			]}
			rowHref={(key) => `/list/dns/records?domain=${encodeURIComponent(key)}`}
			rowActions={(key, row) => (
				<>
					<RowAction
						href={`/edit/dns?domain=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>{" "}
					<form action={toggleDnsDomainAction} style={{ display: "inline" }}>
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
					</form>{" "}
					<RowAction
						href={`/delete/dns?domain=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/dns">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add DNS Zone")}
			</Link>
		</ListView>
	);
}
