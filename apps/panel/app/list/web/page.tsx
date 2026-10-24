import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
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
				{ key: "DATE", label: t("Date") }
			]}
			rowActions={(key, row) => (<>
				<Link href={`/edit/web?domain=${encodeURIComponent(key)}`}>{t("Edit")}</Link>
				{" "}
				<form action={toggleWebDomainAction} style={{ display: "inline" }}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="domain" value={key} />
										<input type="hidden" name="op" value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"} />
										<button type="submit" className="link-button">{row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}</button>
									</form>
				{" "}
				<Link href={`/delete/web?domain=${encodeURIComponent(key)}`}>{t("Delete")}</Link>
			</>)}
		>
			<p><Link className="button" href="/add/web">{t("Add Web Domain")}</Link></p>
		</ListView>
	);
}
