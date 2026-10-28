import Link from "next/link";
import type { AccessKeyRecord } from "@hestiacp/lib";
import { getT, hestia, requireSession, sessions } from "@/lib/panel";

/**
 * One access key (PHP web/templates/pages/list_access_key.php): Back
 * button, Access Key ID, Permissions list, Comment. The Secret Key is
 * shown ONLY right after creation (PHP's ok_msg gate): the add action
 * stashes {id, secret} in the session as a JSON string, this page
 * reads it once for ?created=1 and clears it. A plain visit never
 * shows the secret, even though v-list-access-key's JSON carries it.
 */
export default async function AccessKeyDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ created?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const { id } = await params;
	const keyId = decodeURIComponent(id);
	const query = await searchParams;
	let record: AccessKeyRecord;
	try {
		record = await hestia.listAccessKey(keyId);
	} catch {
		return (
			<div className="card">
				<h1>{t("Access Key")}</h1>
				<p className="error">
					{t("No such access key")}: {keyId}
				</p>
				<p>
					<Link href="/list/access-key">{t("Back")}</Link>
				</p>
			</div>
		);
	}
	let secret: string | null = null;
	if (query.created === "1") {
		const raw = session.data.hestiang_new_access_key;
		if (typeof raw === "string") {
			try {
				const stashed = JSON.parse(raw) as { id?: unknown; secret?: unknown };
				if (stashed.id === keyId && typeof stashed.secret === "string") {
					secret = stashed.secret;
				}
			} catch {
				// Malformed stash: treat as no secret.
			}
		}
		if (session.data.hestiang_new_access_key !== undefined) {
			delete session.data.hestiang_new_access_key;
			await sessions.set(session.id, session.data);
		}
	}
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<div className="toolbar-buttons">
						<Link
							className="button button-secondary button-back js-button-back"
							href="/list/access-key"
						>
							<i className="fas fa-arrow-left icon-blue"></i>
							{t("Back")}
						</Link>
					</div>
				</div>
			</div>
			<div className="container">
				<div className="form-container">
					<h1 className="u-mb20">{t("Access Key")}</h1>
					{record.ACCESS_KEY_ID ? (
						<div className="u-mt15 u-mb10">
							<label htmlFor="access_key_id" className="form-label">
								{t("Access Key ID")}
							</label>
							<input
								type="text"
								className="form-control"
								id="access_key_id"
								maxLength={255}
								readOnly
								value={record.ACCESS_KEY_ID}
							/>
						</div>
					) : null}
					{secret ? (
						<div className="u-mb20">
							<label htmlFor="secret_key" className="form-label">
								{t("Secret Key")}
								<br />
								<span className="inline-alert inline-alert-warning u-mb20">
									{t("Warning! Last chance to save secret key!")}
								</span>
							</label>
							<input
								type="text"
								className="form-control"
								id="secret_key"
								maxLength={255}
								readOnly
								value={secret}
							/>
						</div>
					) : null}
					<p className="u-mb10">{t("Permissions")}</p>
					<ul className="u-list-bulleted u-mb10">
						{record.PERMISSIONS.map((api) => (
							<li key={api}>{t(api)}</li>
						))}
					</ul>
					<div className="u-mb10">
						<label htmlFor="service" className="form-label">
							{t("Comment")}
						</label>
						<input
							type="text"
							className="form-control"
							id="service"
							maxLength={255}
							readOnly
							value={record.COMMENT}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
