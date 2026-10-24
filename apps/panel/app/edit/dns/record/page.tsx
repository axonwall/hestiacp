import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { editDnsRecordAction } from "./actions";

const RECORD_TYPES = ["A", "AAAA", "CNAME", "MX", "TXT", "NS", "SRV", "CAA", "PTR"];

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; id?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const domain = query.domain ?? "";
	const id = query.id ?? "";
	const records = domain
		? await hestia.listDnsRecords(user, domain).catch((): Record<string, HestiaRow> => ({}))
		: {};
	const current = records[id];
	if (!current) {
		return (
			<div className="card">
				<h1>{t("Edit DNS Record")}</h1>
				<p className="error">{query.error ?? "Record not found."}</p>
				<p><a href="/list/dns">{t("Back")}</a></p>
			</div>
		);
	}
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit DNS Record")} — {domain} #{id}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={editDnsRecordAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<input type="hidden" name="id" value={id} />
				<label htmlFor="rec">{t("Record")}</label>
				<input className="form-control" id="rec" name="rec" defaultValue={current.RECORD} />
				<label htmlFor="type">{t("Type")}</label>
				<select className="form-select" id="type" name="type" defaultValue={current.TYPE}>
					{RECORD_TYPES.map((rt) => (
						<option key={rt} value={rt}>{rt}</option>
					))}
				</select>
				<label htmlFor="value">{t("Value")}</label>
				<input className="form-control" id="value" name="value" defaultValue={current.VALUE} />
				<label htmlFor="priority">{t("Priority")}</label>
				<input className="form-control" id="priority" name="priority" defaultValue={current.PRIORITY ?? ""} />
				<label htmlFor="ttl">TTL</label>
				<input className="form-control" id="ttl" name="ttl" defaultValue={current.TTL ?? ""} />
				<label htmlFor="newId">{t("Record ID")}</label>
				<input className="form-control" id="newId" name="newId" defaultValue={id} />
				<button type="submit" className="button">{t("Save")}</button>
			</form>
			<p>
				<a href={`/edit/dns?domain=${encodeURIComponent(domain)}`}>{t("Back")}</a>
			</p>
		</div>
	);
}
