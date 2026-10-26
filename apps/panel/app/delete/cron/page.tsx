import { getT, requireSession } from "@/lib/panel";
import { deleteCronJobAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ job?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const job = query.job ?? "";
	const token = String(session.data.token ?? "");
	return (
		<div>
			<h1>
				{t("Delete Cron Job")} #{job}
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
					This deletes cron job <strong>#{job}</strong>. There is no undo.
				</p>
				<form action={deleteCronJobAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="job" value={job} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> {t("Yes, delete it")}
					</label>
					<button type="submit">{t("Delete")}</button>
				</form>
			</div>
			<p>
				<a href="/list/cron">{t("Back")}</a>
			</p>
		</div>
	);
}
