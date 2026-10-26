import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { addFirewallBanAction, bulkFirewallBanAction, deleteFirewallBanAction } from "../actions";

export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallBan());
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("Banlist")}
			result={result}
			emptyText={t("There are currently no banned IP addresses.")}
			columns={[
				{ key: "IP", label: t("IP Address") },
				{
					key: "DATE",
					label: t("Date"),
					format: (v) => <time dateTime={v}>{v}</time>,
				},
				{ key: "TIME", label: t("Time") },
				{ key: "CHAIN", label: t("Chain") },
			]}
			rowActions={(key, row) => [
				<form action={deleteFirewallBanAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="ip" value={key} />
					<input type="hidden" name="chain" value={row.CHAIN ?? "INPUT"} />
					<RowActionButton title={t("Unban")} icon="fa-ban icon-green" />
				</form>,
			]}
			footer={{
				singular: t("banned IP address"),
				plural: t("banned IP addresses"),
			}}
			checkboxName="ipchain[]"
			bulkAction={bulkFirewallBanAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			containerId="list-firewall-banlist"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/firewall">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<form action={addFirewallBanAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="banIp">{t("Ban an IP")}</label>
				<input className="form-control" id="banIp" name="ip" required placeholder="198.51.100.9" />
				<label htmlFor="banChain">{t("Chain")}</label>
				<input className="form-control" id="banChain" name="chain" defaultValue="INPUT" />
				<button type="submit" className="button">
					{t("Ban")}
				</button>
			</form>
		</ListView>
	);
}
