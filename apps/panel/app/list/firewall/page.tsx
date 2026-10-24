import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";

export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallRules());
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("Firewall")}
			result={result}
			columns={[
				{ key: "RULE", label: t("Rule") },
				{ key: "ACTION", label: t("Action") },
				{ key: "PROTOCOL", label: t("Protocol") },
				{ key: "PORT", label: t("Port") },
				{ key: "IP", label: t("IP") },
				{ key: "COMMENT", label: t("Comment") },
				{ key: "SUSPENDED", label: t("Suspended") },
			]}
			rowActions={(key) => (
				<>
					<Link href={`/edit/firewall?rule=${encodeURIComponent(key)}`}>
						{t("Edit")}
					</Link>{" "}
					<Link href={`/delete/firewall?rule=${encodeURIComponent(key)}`}>
						{t("Delete")}
					</Link>
				</>
			)}
		>
			<Link href="/add/firewall">{t("Add rule")}</Link>
			{" · "}
			<Link href="/list/firewall/banlist">{t("Banlist")}</Link>
			{" · "}
			<Link href="/list/firewall/ipset">{t("IP Sets")}</Link>
			<span data-token={token} hidden />
		</ListView>
	);
}
