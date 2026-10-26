import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { editMailAccountAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; account?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const domain = query.domain ?? "";
	const account = query.account ?? "";
	const record =
		domain && account
			? await hestia.listMailAccount(user, domain, account).catch(() => null)
			: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Mail Account")}</h1>
				<p className="error">{query.error ?? "Account not found."}</p>
				<p>
					<a href="/list/mail">{t("Back")}</a>
				</p>
			</div>
		);
	}
	const autoreplyMessage =
		record.AUTOREPLY === "yes"
			? await hestia.listMailAccountAutoreply(user, domain, account).catch(() => "")
			: "";
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{account}@{domain}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<form action={editMailAccountAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<input type="hidden" name="account" value={account} />
				<label htmlFor="secret">
					{t("New password")} ({t("leave empty to keep")})
				</label>
				<input
					className="form-control"
					id="secret"
					name="secret"
					type="password"
					autoComplete="new-password"
				/>
				<label htmlFor="quota">
					{t("Quota")} (MB, {t("empty for unlimited")})
				</label>
				<input
					className="form-control"
					id="quota"
					name="quota"
					defaultValue={record.QUOTA === "unlimited" ? "" : record.QUOTA}
				/>
				{isAdmin ? (
					<>
						<label htmlFor="rate">{t("Rate limit")}</label>
						<input
							className="form-control"
							id="rate"
							name="rate"
							defaultValue={record.RATE_LIMIT ?? ""}
						/>
					</>
				) : null}
				<label htmlFor="aliases">{t("Aliases")}</label>
				<textarea
					className="form-control"
					id="aliases"
					name="aliases"
					rows={2}
					defaultValue={(record.ALIAS ?? "").split(",").filter(Boolean).join("\n")}
				/>
				<label htmlFor="forwards">{t("Forwarders")}</label>
				<textarea
					className="form-control"
					id="forwards"
					name="forwards"
					rows={2}
					defaultValue={(record.FWD ?? "").split(",").filter(Boolean).join("\n")}
				/>
				<label>
					<input
						type="checkbox"
						name="fwdOnly"
						value="yes"
						defaultChecked={record.FWD_ONLY === "yes"}
					/>{" "}
					{t("Forward only")}
				</label>
				<label>
					<input
						type="checkbox"
						name="autoreply"
						value="yes"
						defaultChecked={record.AUTOREPLY === "yes"}
					/>{" "}
					{t("Autoreply")}
				</label>
				<label htmlFor="autoreplyMessage">{t("Autoreply message")}</label>
				<textarea
					className="form-control"
					id="autoreplyMessage"
					name="autoreplyMessage"
					rows={3}
					defaultValue={autoreplyMessage}
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			<p>
				<a href={`/list/mail/accounts?domain=${encodeURIComponent(domain)}`}>{t("Back")}</a> ·{" "}
				<a
					href={`/delete/mail/account?domain=${encodeURIComponent(domain)}&account=${encodeURIComponent(account)}`}
				>
					{t("Delete")}
				</a>
			</p>
		</div>
	);
}
