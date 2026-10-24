import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { editCronJobAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ job?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const job = query.job ?? "";
	const record = job
		? await hestia.listCronJob(user, job).catch(() => null)
		: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Cron Job")}</h1>
				<p className="error">{query.error ?? "Job not found."}</p>
				<p><a href="/list/cron">{t("Back")}</a></p>
			</div>
		);
	}
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit Cron Job")} #{job}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<form action={editCronJobAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="job" value={job} />
				<label htmlFor="min">{t("Minute")}</label>
				<input id="min" name="min" defaultValue={record.MIN} required />
				<label htmlFor="hour">{t("Hour")}</label>
				<input id="hour" name="hour" defaultValue={record.HOUR} required />
				<label htmlFor="day">{t("Day")}</label>
				<input id="day" name="day" defaultValue={record.DAY} required />
				<label htmlFor="month">{t("Month")}</label>
				<input id="month" name="month" defaultValue={record.MONTH} required />
				<label htmlFor="wday">{t("Day of Week")}</label>
				<input id="wday" name="wday" defaultValue={record.WDAY} required />
				<label htmlFor="cmd">{t("Command")}</label>
				<input id="cmd" name="cmd" defaultValue={record.CMD} required />
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
			<p>
				<a href="/list/cron">{t("Back")}</a> ·{" "}
				<a href={`/delete/cron?job=${encodeURIComponent(job)}`}>{t("Delete")}</a>
			</p>
		</div>
	);
}
