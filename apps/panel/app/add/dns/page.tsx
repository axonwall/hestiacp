import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { addDnsDomainAction, addDnsRecordAction } from "./actions";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "PTR"];

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const [ips, templates, zones, record] = await Promise.all([
		hestia.listUserIps(user).catch(() => ({})),
		hestia.listDnsTemplates().catch(() => ["default"]),
		hestia.listDnsDomains(user).catch(() => ({})),
		hestia.listUser(user).catch(() => null),
	]);
	const token = String(session.data.token ?? "");
	const userNs = (record?.NS ?? "").split(",").filter(Boolean);
	const defaultExp = new Date(Date.now() + 365 * 86400_000).toISOString().slice(0, 10);
	return (
		<div>
			<div className="card">
				<h1>{t("Add DNS Zone")}</h1>
				{query.error ? <p className="error">{query.error}</p> : null}
				{query.saved ? <p>{t("Saved")}</p> : null}
				<form action={addDnsDomainAction}>
					<input type="hidden" name="token" value={token} />
					<label htmlFor="domain">{t("Domain")}</label>
					<input
						className="form-control"
						id="domain"
						name="domain"
						required
						placeholder="example.com"
					/>
					<label htmlFor="ip">{t("IP Address")}</label>
					<select className="form-select" id="ip" name="ip">
						{Object.keys(ips).map((ip) => (
							<option key={ip} value={ip}>
								{ip}
							</option>
						))}
					</select>
					<label htmlFor="template">{t("Template")}</label>
					<select className="form-select" id="template" name="template">
						{templates.map((tpl) => (
							<option key={tpl} value={tpl}>
								{tpl}
							</option>
						))}
					</select>
					{[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
						<span key={i}>
							<label htmlFor={`ns${i}`}>NS {i}</label>
							<input
								className="form-control"
								id={`ns${i}`}
								name={`ns${i}`}
								defaultValue={userNs[i - 1] ?? ""}
							/>
						</span>
					))}
					<label htmlFor="exp">{t("Expiration")}</label>
					<input
						className="form-control"
						id="exp"
						name="exp"
						type="date"
						defaultValue={defaultExp}
					/>
					<label htmlFor="ttl">TTL</label>
					<input className="form-control" id="ttl" name="ttl" defaultValue="14400" />
					<label>
						<input type="checkbox" name="dnssec" value="yes" /> DNSSEC
					</label>
					<button type="submit" className="button">
						{t("Add")}
					</button>
				</form>
			</div>
			<div className="card" style={{ marginTop: "1rem" }}>
				<h2>{t("Add DNS Record")}</h2>
				<form action={addDnsRecordAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="back" value="/add/dns" />
					<label htmlFor="rdomain">{t("Domain")}</label>
					<select className="form-select" id="rdomain" name="domain">
						{Object.keys(zones).map((zone) => (
							<option key={zone} value={zone}>
								{zone}
							</option>
						))}
					</select>
					<label htmlFor="rec">{t("Record")}</label>
					<input className="form-control" id="rec" name="rec" placeholder="www" />
					<label htmlFor="type">{t("Type")}</label>
					<select className="form-select" id="type" name="type">
						{RECORD_TYPES.map((rt) => (
							<option key={rt} value={rt}>
								{rt}
							</option>
						))}
					</select>
					<label htmlFor="value">{t("Value")}</label>
					<input className="form-control" id="value" name="value" required />
					<label htmlFor="priority">{t("Priority")}</label>
					<input className="form-control" id="priority" name="priority" />
					<label htmlFor="rttl">TTL</label>
					<input className="form-control" id="rttl" name="ttl" />
					<button type="submit" className="button">
						{t("Add")}
					</button>
				</form>
			</div>
		</div>
	);
}
