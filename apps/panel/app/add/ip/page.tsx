import Link from "next/link";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import { addSysIpAction } from "../../list/ip/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const users = await hestia.listUsers().catch(() => ({}));
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Add IP address")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addSysIpAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="ipAddr">{t("IP")}</label>
				<input className="form-control" id="ipAddr" name="ip" required />
				<label htmlFor="ipMask">{t("Netmask")}</label>
				<input
					className="form-control"
					id="ipMask"
					name="netmask"
					required
					defaultValue="255.255.255.0"
				/>
				<label htmlFor="ipIface">{t("Interface")}</label>
				<input className="form-control" id="ipIface" name="iface" required defaultValue="eth0" />
				<label htmlFor="ipOwner">{t("Owner")}</label>
				<select className="form-select" id="ipOwner" name="owner">
					{Object.keys(users).map((u) => (
						<option key={u} value={u}>
							{u}
						</option>
					))}
				</select>
				<label>
					<input type="checkbox" name="shared" value="yes" defaultChecked /> {t("Shared")}
				</label>
				<label htmlFor="ipName">{t("Name")}</label>
				<input className="form-control" id="ipName" name="name" />
				<label htmlFor="ipNat">{t("NAT")}</label>
				<input className="form-control" id="ipNat" name="nat" />
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
			<p>
				<Link href="/list/ip">← {t("IP Addresses")}</Link>
			</p>
		</div>
	);
}
