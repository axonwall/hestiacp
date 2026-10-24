import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
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
		></ListView>
	);
}
