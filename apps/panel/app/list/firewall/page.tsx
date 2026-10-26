import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";

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
					<RowAction
						href={`/edit/firewall?rule=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>
					<RowAction
						href={`/delete/firewall?rule=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/firewall">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add rule")}
			</Link>
			{" · "}
			<Link className="button button-secondary" href="/list/firewall/banlist">
				{t("Banlist")}
			</Link>
			{" · "}
			<Link className="button button-secondary" href="/list/firewall/ipset">
				{t("IP Sets")}
			</Link>
			<span data-token={token} hidden />
		</ListView>
	);
}
