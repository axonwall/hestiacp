import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { toggleWebDomainAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const result = await loadRows(() => hestia.listWebDomains(user));
	return (
		<ListView
			title={t("Web Domains")}
			result={result}
			columns={[
				{ key: "DOMAIN", label: t("Web Domains") },
				{ key: "IP", label: t("IP") },
				{ key: "SSL", label: t("SSL") },
				{ key: "LETSENCRYPT", label: t("Let's Encrypt") },
				{ key: "SUSPENDED", label: t("Suspended") },
				{ key: "DATE", label: t("Date") },
			]}
			rowActions={(key, row) => (
				<>
					<RowAction
						href={`/edit/web?domain=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>{" "}
					<form action={toggleWebDomainAction} style={{ display: "inline" }}>
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
						href={`/delete/web?domain=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/web">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Web Domain")}
			</Link>
		</ListView>
	);
}
