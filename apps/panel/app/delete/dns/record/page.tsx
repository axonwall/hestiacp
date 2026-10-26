import { getT, requireSession } from "@/lib/panel";
import { deleteDnsRecordAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; id?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const domain = query.domain ?? "";
	const id = query.id ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div>
			<h1>
				{t("Delete DNS Record")} #{id} — {domain}
			</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<p>
					This deletes record <strong>#{id}</strong> from zone <strong>{domain}</strong>. There is
					no undo.
				</p>
				<form action={deleteDnsRecordAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<input type="hidden" name="id" value={id} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
					</label>
					<button type="submit">{t("Delete")}</button>
				</form>
			</div>
			<p>
				<a href="/list/dns">{t("Back")}</a>
			</p>
		</div>
	);
}
