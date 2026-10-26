import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView, statusIcon } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import {
	addFirewallIpsetAction,
	bulkFirewallIpsetAction,
	deleteFirewallIpsetAction,
} from "../actions";

export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallIpset());
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("IP Sets")}
			result={result}
			emptyText={t("There are currently no IP lists defined.")}
			columns={[
				{ key: "IPSET", label: t("IP List Name") },
				{
					key: "AUTOUPDATE",
					label: t("Auto Update"),
					format: (v) => statusIcon(v, false, t("Auto Update On"), t("Auto Update Off")),
				},
				{ key: "IP_VERSION", label: t("IP Version") },
				{
					key: "DATE",
					label: t("Date"),
					format: (v) => <time dateTime={v}>{v}</time>,
				},
				{ key: "TIME", label: t("Time") },
			]}
			rowActions={(key) => [
				<form key="delete" action={deleteFirewallIpsetAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="name" value={key} />
					<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
				</form>,
			]}
			footer={{ singular: t("IP list"), plural: t("IP lists") }}
			checkboxName="setname[]"
			bulkAction={bulkFirewallIpsetAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			containerId="list-firewall-ipset"
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
			<form action={addFirewallIpsetAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="setName">{t("Add IP set")}</label>
				<input className="form-control" id="setName" name="name" required placeholder="blocklist" />
				<label htmlFor="setSource">{t("Source")}</label>
				<input
					className="form-control"
					id="setSource"
					name="source"
					required
					placeholder="file:/path or https://…"
				/>
				<label htmlFor="setVer">{t("Version")}</label>
				<select className="form-select" id="setVer" name="ipver" defaultValue="v4">
					<option value="v4">IPv4</option>
					<option value="v6">IPv6</option>
				</select>
				<label>
					<input type="checkbox" name="autoupdate" value="yes" /> {t("Autoupdate")}
				</label>
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
		</ListView>
	);
}
