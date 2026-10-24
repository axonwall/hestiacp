import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { addDnsRecordAction } from "@/app/add/dns/actions";
import { editDnsDomainAction, toggleDnsRecordAction } from "./actions";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "PTR"];

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const domain = query.domain ?? "";
	const record = domain
		? await hestia.listDnsDomain(user, domain).catch(() => null)
		: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit DNS Zone")}</h1>
				<p className="error">{query.error ?? "Zone not found."}</p>
				<p><a href="/list/dns">{t("Back")}</a></p>
			</div>
		);
	}
	const [ips, templates, records] = await Promise.all([
		hestia.listUserIps(user).catch((): Record<string, HestiaRow> => ({})),
		hestia.listDnsTemplates().catch(() => ["default"]),
		hestia.listDnsRecords(user, domain).catch(() => ({})),
	]);
	const token = String(session.data.token ?? "");
	return (
		<div>
			<div className="card">
				<h1>
					{t("Edit DNS Zone")} — {domain}
				</h1>
				{query.error ? <p className="error">{query.error}</p> : null}
				{query.saved ? <p>{t("Saved")}</p> : null}
				<form action={editDnsDomainAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<label htmlFor="ip">{t("IP Address")}</label>
					<select id="ip" name="ip" defaultValue={record.IP}>
						{Object.keys(ips).map((ip) => (
							<option key={ip} value={ip}>{ip}</option>
						))}
						{!ips[record.IP] ? <option value={record.IP}>{record.IP}</option> : null}
					</select>
					<label htmlFor="template">{t("Template")}</label>
					<select id="template" name="template" defaultValue={record.TPL}>
						{templates.map((tpl) => (
							<option key={tpl} value={tpl}>{tpl}</option>
						))}
					</select>
					<label htmlFor="soa">SOA</label>
					<input id="soa" name="soa" defaultValue={record.SOA} />
					<label htmlFor="exp">{t("Expiration")}</label>
					<input id="exp" name="exp" type="date" defaultValue={record.EXP} />
					<label htmlFor="ttl">TTL</label>
					<input id="ttl" name="ttl" defaultValue={record.TTL} />
					<label>
						<input type="checkbox" name="dnssec" value="yes" defaultChecked={record.DNSSEC === "yes"} />{" "}
						DNSSEC
					</label>
					<button type="submit" className="primary">{t("Save")}</button>
				</form>
				<p>
					<a href="/list/dns">{t("Back")}</a> ·{" "}
					<a href={`/delete/dns?domain=${encodeURIComponent(domain)}`}>{t("Delete")}</a>
				</p>
			</div>
			<div className="card" style={{ marginTop: "1rem" }}>
				<h2>{t("DNS Records")}</h2>
				<table className="grid">
					<thead>
						<tr>
							<th>{t("Record")}</th>
							<th>{t("Type")}</th>
							<th>{t("Value")}</th>
							<th>{t("Suspended")}</th>
							<th>{t("Actions")}</th>
						</tr>
					</thead>
					<tbody>
						{Object.entries(records).map(([id, rec]) => (
							<tr key={id}>
								<td>{rec.RECORD}</td>
								<td>{rec.TYPE}</td>
								<td>{rec.VALUE}</td>
								<td>{rec.SUSPENDED}</td>
								<td>
									<Link
										href={`/edit/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`}
									>
										{t("Edit")}
									</Link>{" "}
									<form action={toggleDnsRecordAction} style={{ display: "inline" }}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="domain" value={domain} />
										<input type="hidden" name="id" value={id} />
										<input
											type="hidden"
											name="op"
											value={rec.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
										/>
										<button type="submit" className="link-button">
											{rec.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
										</button>
									</form>{" "}
									<Link
										href={`/delete/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`}
									>
										{t("Delete")}
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
				<h3>{t("Add DNS Record")}</h3>
				<form action={addDnsRecordAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<input
						type="hidden"
						name="back"
						value={`/edit/dns?domain=${encodeURIComponent(domain)}`}
					/>
					<label htmlFor="rec">{t("Record")}</label>
					<input id="rec" name="rec" />
					<label htmlFor="rtype">{t("Type")}</label>
					<select id="rtype" name="type">
						{RECORD_TYPES.map((rt) => (
							<option key={rt} value={rt}>{rt}</option>
						))}
					</select>
					<label htmlFor="rvalue">{t("Value")}</label>
					<input id="rvalue" name="value" required />
					<label htmlFor="rpriority">{t("Priority")}</label>
					<input id="rpriority" name="priority" />
					<label htmlFor="rttl">TTL</label>
					<input id="rttl" name="ttl" />
					<button type="submit" className="primary">{t("Add")}</button>
				</form>
			</div>
		</div>
	);
}
