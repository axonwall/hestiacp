import { getT, requireSession } from "@/lib/panel";
import { addMailDomainAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Add Mail Domain")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addMailDomainAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="domain">{t("Domain")}</label>
				<input
					className="form-control"
					id="domain"
					name="domain"
					required
					placeholder="example.com"
				/>
				<label>
					<input type="checkbox" name="antispam" value="yes" defaultChecked /> {t("Antispam")}
				</label>
				<label>
					<input type="checkbox" name="antivirus" value="yes" defaultChecked /> {t("Antivirus")}
				</label>
				<label>
					<input type="checkbox" name="dkim" value="yes" defaultChecked /> DKIM
				</label>
				<label htmlFor="dkimSelector">{t("DKIM selector")}</label>
				<input className="form-control" id="dkimSelector" name="dkimSelector" defaultValue="mail" />
				<label>
					<input type="checkbox" name="reject" value="yes" /> {t("Reject spam")}
				</label>
				<label htmlFor="webmail">{t("Webmail alias")}</label>
				<input className="form-control" id="webmail" name="webmail" placeholder="webmail" />
				<label>
					<input type="checkbox" name="relay" value="yes" /> {t("SMTP Relay")}
				</label>
				<label htmlFor="relayHost">{t("Relay host")}</label>
				<input className="form-control" id="relayHost" name="relayHost" />
				<label htmlFor="relayPort">{t("Relay port")}</label>
				<input className="form-control" id="relayPort" name="relayPort" placeholder="587" />
				<label htmlFor="relayUser">{t("Relay user")}</label>
				<input className="form-control" id="relayUser" name="relayUser" />
				<label htmlFor="relayPass">{t("Relay password")}</label>
				<input
					className="form-control"
					id="relayPass"
					name="relayPass"
					type="password"
					autoComplete="new-password"
				/>
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
		</div>
	);
}
