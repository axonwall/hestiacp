import Link from "next/link";
import { getT, requireAdmin } from "@/lib/panel";
import { deleteFirewallRuleAction } from "../../list/firewall/actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ rule?: string; error?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const rule = query.rule ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Delete Firewall Rule")} #{rule}
			</h1>
			{query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<form action={deleteFirewallRuleAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="rule" value={rule} />
				<label>
					<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
				</label>
				<button type="submit" className="button button-danger">
					{t("Delete")}
				</button>
			</form>
			<p>
				<Link href="/list/firewall">← {t("Firewall")}</Link>
			</p>
		</div>
	);
}
