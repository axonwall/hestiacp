import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { addMailAccountAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; domain?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const domains = await hestia.listMailDomains(user).catch(() => ({}));
	const token = String(session.data.token ?? "");
	const isAdmin = session.data.userContext === "admin";
	return (
		<div className="card">
			<h1>{t("Add Mail Account")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addMailAccountAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="domain">{t("Domain")}</label>
				<select className="form-select" id="domain" name="domain" defaultValue={query.domain ?? ""}>
					{Object.keys(domains).map((d) => (
						<option key={d} value={d}>
							{d}
						</option>
					))}
				</select>
				<label htmlFor="account">{t("Account")}</label>
				<input className="form-control" id="account" name="account" required />
				<label htmlFor="secret">{t("Password")}</label>
				<input
					className="form-control"
					id="secret"
					name="secret"
					type="password"
					required
					autoComplete="new-password"
				/>
				<label htmlFor="quota">
					{t("Quota")} (MB, {t("empty for unlimited")})
				</label>
				<input className="form-control" id="quota" name="quota" />
				<label htmlFor="aliases">{t("Aliases")}</label>
				<textarea className="form-control" id="aliases" name="aliases" rows={2} />
				<label htmlFor="forwards">{t("Forwarders")}</label>
				<textarea className="form-control" id="forwards" name="forwards" rows={2} />
				<label>
					<input type="checkbox" name="blackhole" value="yes" /> {t("Discard all mail")}
				</label>
				<label>
					<input type="checkbox" name="fwdOnly" value="yes" /> {t("Forward only")}
				</label>
				{isAdmin ? (
					<>
						<label htmlFor="rate">{t("Rate limit")}</label>
						<input className="form-control" id="rate" name="rate" />
					</>
				) : null}
				<label htmlFor="notifyEmail">{t("Email login credentials to:")}</label>
				<input className="form-control" id="notifyEmail" name="notifyEmail" type="email" />
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
		</div>
	);
}
