import { getT, requireSession } from "@/lib/panel";
import { addCronJobAction } from "./actions";

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
			<h1>{t("Add Cron Job")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<form action={addCronJobAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="min">{t("Minute")}</label>
				<input className="form-control" id="min" name="min" required placeholder="0" />
				<label htmlFor="hour">{t("Hour")}</label>
				<input className="form-control" id="hour" name="hour" required placeholder="3" />
				<label htmlFor="day">{t("Day")}</label>
				<input className="form-control" id="day" name="day" required placeholder="*" />
				<label htmlFor="month">{t("Month")}</label>
				<input className="form-control" id="month" name="month" required placeholder="*" />
				<label htmlFor="wday">{t("Day of Week")}</label>
				<input className="form-control" id="wday" name="wday" required placeholder="*" />
				<label htmlFor="cmd">{t("Command")}</label>
				<input className="form-control" id="cmd" name="cmd" required />
				<button type="submit" className="button">{t("Add")}</button>
			</form>
		</div>
	);
}
