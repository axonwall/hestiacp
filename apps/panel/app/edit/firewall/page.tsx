import Link from "next/link";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import { editFirewallRuleAction } from "../../list/firewall/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ rule?: string; error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const rule = query.rule ?? "";
	const record = rule
		? await hestia.listFirewallRule(rule).catch(() => undefined)
		: undefined;
	const token = String(session.data.token ?? "");
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Firewall Rule")}</h1>
				<p className="error">Rule not found.</p>
				<p>
					<Link href="/list/firewall">← {t("Firewall")}</Link>
				</p>
			</div>
		);
	}
	return (
		<div className="card">
			<h1>
				{t("Edit Firewall Rule")} #{rule}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={editFirewallRuleAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="rule" value={rule} />
				<label htmlFor="fwAction">{t("Action")}</label>
				<select className="form-select" id="fwAction" name="action" defaultValue={record.ACTION}>
					<option value="ACCEPT">ACCEPT</option>
					<option value="DROP">DROP</option>
				</select>
				<label htmlFor="fwIp">{t("IP / CIDR")}</label>
				<input className="form-control" id="fwIp" name="ip" required defaultValue={record.IP} />
				<label htmlFor="fwPort">{t("Port")}</label>
				<input className="form-control" id="fwPort" name="port" required defaultValue={record.PORT} />
				<label htmlFor="fwProtocol">{t("Protocol")}</label>
				<select className="form-select" id="fwProtocol" name="protocol" defaultValue={record.PROTOCOL}>
					<option value="TCP">TCP</option>
					<option value="UDP">UDP</option>
					<option value="ICMP">ICMP</option>
				</select>
				<label htmlFor="fwComment">{t("Comment")}</label>
				<input className="form-control" id="fwComment" name="comment" defaultValue={record.COMMENT ?? ""} />
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			<p>
				<Link href="/list/firewall">← {t("Firewall")}</Link>
			</p>
		</div>
	);
}
