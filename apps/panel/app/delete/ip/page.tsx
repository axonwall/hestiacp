import Link from "next/link";
import { getT, requireAdmin } from "@/lib/panel";
import { deleteSysIpAction } from "../../list/ip/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ ip?: string; error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const ip = query.ip ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Delete IP address")} — {ip}
			</h1>
			{query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<form action={deleteSysIpAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="ip" value={ip} />
				<label>
					<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
				</label>
				<button type="submit" className="danger">
					{t("Delete")}
				</button>
			</form>
			<p>
				<Link href="/list/ip">← {t("IP Addresses")}</Link>
			</p>
		</div>
	);
}
