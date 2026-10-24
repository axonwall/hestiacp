import { getT, requireSession } from "@/lib/panel";
import { deleteMailDomainAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const domain = query.domain ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div>
			<h1>{t("Delete Mail Domain")} {domain}</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<p>This permanently deletes the mail domain <strong>{domain}</strong> with all accounts and stored mail. There is no undo.</p>
				<form action={deleteMailDomainAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
					</label>
					<button type="submit">{t("Delete")}</button>
				</form>
			</div>
			<p>
				<a href="/list/mail">{t("Back")}</a>
			</p>
		</div>
	);
}
