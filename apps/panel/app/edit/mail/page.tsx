import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { editMailDomainAction } from "./actions";
import { editMailDomainExtrasAction } from "./extras-actions";
import { editMailDomainSslAction } from "./ssl-actions";

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
	const sslRecord =
		record.SSL === "yes"
			? await hestia.listMailDomainSsl(user, domain).catch(() => null)
			: null;
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
			<h2>{t("Webmail")} + {t("SMTP Relay")}</h2>
			{query.error === "relay" ? (
				<p className="error">
					Changing relay settings requires the relay password.
				</p>
			) : null}
			<form action={editMailDomainExtrasAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label htmlFor="webmail">{t("Webmail alias")}</label>
				<input id="webmail" name="webmail" defaultValue={record.WEBMAIL ?? ""} placeholder="webmail" />
				<label>
					<input type="checkbox" name="relay" value="yes" defaultChecked={record.U_SMTP_RELAY === "yes"} />{" "}
					{t("SMTP Relay")}
				</label>
				<label htmlFor="relayHost">{t("Relay host")}</label>
				<input id="relayHost" name="relayHost" defaultValue={record.U_SMTP_RELAY_HOST ?? ""} />
				<label htmlFor="relayPort">{t("Relay port")}</label>
				<input id="relayPort" name="relayPort" defaultValue={record.U_SMTP_RELAY_PORT ?? ""} placeholder="587" />
				<label htmlFor="relayUser">{t("Relay user")}</label>
				<input id="relayUser" name="relayUser" defaultValue={record.U_SMTP_RELAY_USERNAME ?? ""} />
				<label htmlFor="relayPass">{t("Relay password")}</label>
				<input id="relayPass" name="relayPass" type="password" autoComplete="new-password" />
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
			<h2>SSL {t("Certificate")}</h2>
			{sslRecord ? (
				<p>
					{sslRecord.SUBJECT} · {sslRecord.ISSUER} · {sslRecord.NOT_BEFORE} →{" "}
					{sslRecord.NOT_AFTER}
				</p>
			) : null}
			<form action={editMailDomainSslAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label>
					<input type="checkbox" name="letsencrypt" value="yes" defaultChecked={record.LETSENCRYPT === "yes"} />{" "}
					Let&apos;s Encrypt
				</label>
				<label htmlFor="mSslKeyAlgo">{t("SSL key algorithm")}</label>
				<input id="mSslKeyAlgo" name="sslKeyAlgo" defaultValue={record.SSL_KEY_ALGO ?? ""} placeholder="RSA3072 / EC384" />
				{record.SSL === "yes" && record.LETSENCRYPT !== "yes" ? (
					<label>
						<input type="checkbox" name="removeSsl" value="yes" /> {t("Remove SSL certificate")}
					</label>
				) : null}
				<label htmlFor="mSslCrt">{t("Certificate")}</label>
				<textarea id="mSslCrt" name="crt" rows={4} defaultValue={sslRecord?.CRT ?? ""} />
				<label htmlFor="mSslKey">{t("Key")}</label>
				<textarea id="mSslKey" name="key" rows={4} defaultValue={sslRecord?.KEY ?? ""} />
				<label htmlFor="mSslCa">{t("CA chain")}</label>
				<textarea id="mSslCa" name="ca" rows={3} defaultValue={sslRecord?.CA ?? ""} />
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
		</div>
	);
}
