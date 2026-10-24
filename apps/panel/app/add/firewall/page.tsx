import Link from "next/link";
import { getT, requireAdmin } from "@/lib/panel";
import { addFirewallRuleAction } from "../../list/firewall/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Add Firewall Rule")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addFirewallRuleAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="fwAction">{t("Action")}</label>
				<select id="fwAction" name="action" defaultValue="ACCEPT">
					<option value="ACCEPT">ACCEPT</option>
					<option value="DROP">DROP</option>
				</select>
				<label htmlFor="fwIp">{t("IP / CIDR")}</label>
				<input id="fwIp" name="ip" required placeholder="0.0.0.0/0" />
				<label htmlFor="fwPort">{t("Port")}</label>
				<input id="fwPort" name="port" required placeholder="22" />
				<label htmlFor="fwProtocol">{t("Protocol")}</label>
				<select id="fwProtocol" name="protocol" defaultValue="TCP">
					<option value="TCP">TCP</option>
					<option value="UDP">UDP</option>
					<option value="ICMP">ICMP</option>
				</select>
				<label htmlFor="fwComment">{t("Comment")}</label>
				<input id="fwComment" name="comment" />
				<button type="submit" className="primary">
					{t("Add")}
				</button>
			</form>
			<p>
				<Link href="/list/firewall">← {t("Firewall")}</Link>
			</p>
		</div>
	);
}
