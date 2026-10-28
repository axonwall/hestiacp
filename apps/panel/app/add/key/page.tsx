import Link from "next/link";
import { getT, requireSession } from "@/lib/panel";
import { addSshKeyAction } from "./actions";

/** Add an SSH key (PHP web/templates/pages/add_key.php). */
export default async function AddSshKeyPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	return (
		<div>
			<div className="card">
				<h1>{t("Add SSH Key")}</h1>
				{query.error ? <p className="error">{query.error}</p> : null}
				{query.saved ? <p>{t("SSH Key has been created successfully.")}</p> : null}
				<form action={addSshKeyAction}>
					<input type="hidden" name="token" value={token} />
					<label htmlFor="v_key" className="form-label">
						{t("SSH Key")}
					</label>
					<textarea className="form-control u-min-height300" name="v_key" id="v_key" required />
					<button type="submit" className="button">
						{t("Save")}
					</button>
				</form>
				<p>
					<Link href="/list/key">{t("Back")}</Link>
				</p>
			</div>
		</div>
	);
}
