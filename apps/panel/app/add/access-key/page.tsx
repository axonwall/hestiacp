import Link from "next/link";
import { redirect } from "next/navigation";
import type { ApiEntry } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { addAccessKeyAction } from "./actions";

/** Add an access key (PHP web/templates/pages/add_access_key.php). */
export default async function AddAccessKeyPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	const raw = session.data.API_SYSTEM;
	const apiStatus = typeof raw === "string" || typeof raw === "number" ? Number(raw) || 0 : 0;
	if (apiStatus < 1 || (session.data.userContext !== "admin" && apiStatus < 2)) {
		redirect("/edit/user");
	}
	const apis: Record<string, ApiEntry> = await hestia.listApis().catch(() => ({}));
	const names = Object.keys(apis)
		.filter((api) => session.data.userContext === "admin" || apis[api]?.ROLE === "user")
		.sort();
	return (
		<div>
			<div className="card">
				<h1>{t("Add Access Key")}</h1>
				{query.error ? <p className="error">{query.error}</p> : null}
				<form action={addAccessKeyAction}>
					<input type="hidden" name="token" value={token} />
					<p className="u-mb10">{t("Permissions")}</p>
					{names.map((api) => (
						<div className="form-check" key={api}>
							<input
								className="form-check-input"
								type="checkbox"
								value={api}
								name="v_apis[]"
								id={`v_apis_${api}`}
							/>
							<label htmlFor={`v_apis_${api}`}>{t(api)}</label>
						</div>
					))}
					<label htmlFor="v_comment" className="form-label">
						{t("Comment")}
					</label>
					<input
						type="text"
						className="form-control"
						name="v_comment"
						id="v_comment"
						maxLength={255}
					/>
					<button type="submit" className="button">
						{t("Save")}
					</button>
				</form>
				<p>
					<Link href="/list/access-key">{t("Back")}</Link>
				</p>
			</div>
		</div>
	);
}
