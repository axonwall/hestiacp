import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { addWebDomainAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const ips = await hestia.listUserIps(user).catch((): Record<string, HestiaRow> => ({}));
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Add Web Domain")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addWebDomainAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="domain">{t("Domain")}</label>
				<input className="form-control" id="domain" name="domain" required placeholder="example.com" />
				<label htmlFor="ip">{t("IP Address")}</label>
				<select className="form-select" id="ip" name="ip">
					{Object.keys(ips).map((ip) => (
						<option key={ip} value={ip}>
							{ip}
							{ips[ip].NAT ? ` (NAT ${ips[ip].NAT})` : ""}
						</option>
					))}
				</select>
				<label>
					<input type="checkbox" name="dns" value="yes" defaultChecked />{" "}
					{t("Create DNS zone")}
				</label>
				<label>
					<input type="checkbox" name="mail" value="yes" /> {t("Create mail domain")}
				</label>
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
		</div>
	);
}
