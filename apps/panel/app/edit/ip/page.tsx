import Link from "next/link";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import { editSysIpAction } from "../../list/ip/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ ip?: string; error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const ip = query.ip ?? "";
	const record = ip ? await hestia.listSysIp(ip).catch(() => undefined) : undefined;
	const users = await hestia.listUsers().catch(() => ({}));
	const token = String(session.data.token ?? "");
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit IP address")}</h1>
				<p className="error">IP address not found.</p>
				<p>
					<Link href="/list/ip">← {t("IP Addresses")}</Link>
				</p>
			</div>
		);
	}
	return (
		<div className="card">
			<h1>
				{t("Edit IP address")} — {ip}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<dl className="kv">
				<dt>{t("Netmask")}</dt>
				<dd>{record.NETMASK}</dd>
				<dt>{t("Interface")}</dt>
				<dd>{record.INTERFACE}</dd>
			</dl>
			<form action={editSysIpAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="ip" value={ip} />
				<label>
					<input
						type="checkbox"
						name="shared"
						value="yes"
						defaultChecked={record.STATUS === "shared"}
					/>{" "}
					{t("Shared")}
				</label>
				<label htmlFor="ipOwner">{t("Owner")}</label>
				<select className="form-select" id="ipOwner" name="owner" defaultValue={record.OWNER ?? ""}>
					{Object.keys(users).map((u) => (
						<option key={u} value={u}>
							{u}
						</option>
					))}
				</select>
				<label htmlFor="ipName">{t("Name")}</label>
				<input className="form-control" id="ipName" name="name" defaultValue={record.NAME ?? ""} />
				<label htmlFor="ipNat">{t("NAT")}</label>
				<input className="form-control" id="ipNat" name="nat" defaultValue={record.NAT ?? ""} />
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			<p>
				<Link href="/list/ip">← {t("IP Addresses")}</Link>
			</p>
		</div>
	);
}
