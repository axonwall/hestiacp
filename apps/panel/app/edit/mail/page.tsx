import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { editMailDomainAction } from "./actions";

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
		? await hestia.listMailDomain(user, domain).catch(() => null)
		: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Mail Domain")}</h1>
				<p className="error">{query.error ?? "Domain not found."}</p>
				<p><a href="/list/mail">{t("Back")}</a></p>
			</div>
		);
	}
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit Mail Domain")} — {domain}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<form action={editMailDomainAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label>
					<input type="checkbox" name="antispam" value="yes" defaultChecked={record.ANTISPAM === "yes"} />{" "}
					{t("Antispam")}
				</label>
				<label>
					<input type="checkbox" name="antivirus" value="yes" defaultChecked={record.ANTIVIRUS === "yes"} />{" "}
					{t("Antivirus")}
				</label>
				<label>
					<input type="checkbox" name="dkim" value="yes" defaultChecked={record.DKIM === "yes"} /> DKIM
				</label>
				<label htmlFor="dkimSelector">{t("DKIM selector")}</label>
				<input id="dkimSelector" name="dkimSelector" defaultValue={record.DKIM_SELECTOR ?? "mail"} />
				<label>
					<input type="checkbox" name="reject" value="yes" defaultChecked={record.REJECT === "yes"} />{" "}
					{t("Reject spam")}
				</label>
				<label htmlFor="catchall">{t("Catchall")}</label>
				<input id="catchall" name="catchall" defaultValue={record.CATCHALL ?? ""} placeholder="admin@example.com" />
				{isAdmin ? (
					<>
						<label htmlFor="rate">{t("Rate limit")}</label>
						<input id="rate" name="rate" defaultValue={record.RATE_LIMIT ?? ""} />
					</>
				) : null}
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
			<p>
				<a href="/list/mail">{t("Back")}</a> ·{" "}
				<a href={`/list/mail/accounts?domain=${encodeURIComponent(domain)}`}>
					{t("Mail Accounts")}
				</a>{" "}
				·{" "}
				<a href={`/delete/mail?domain=${encodeURIComponent(domain)}`}>{t("Delete")}</a>
			</p>
		</div>
	);
}
