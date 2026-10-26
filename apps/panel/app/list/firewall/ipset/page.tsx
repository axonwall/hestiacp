import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { addFirewallIpsetAction, deleteFirewallIpsetAction } from "../actions";

export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listFirewallIpset());
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("IP Sets")}
			result={result}
			columns={[
				{ key: "IPSET", label: t("IP Sets") },
				{ key: "SOURCE", label: t("Source") },
				{ key: "AUTOUPDATE", label: t("Autoupdate") },
				{ key: "IP_VERSION", label: t("Version") },
			]}
			rowActions={(key) => (
				<form action={deleteFirewallIpsetAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="name" value={key} />
					<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
				</form>
			)}
		>
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
