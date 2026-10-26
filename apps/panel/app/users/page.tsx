import Link from "next/link";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { redirect } from "next/navigation";
import type { HestiaUser } from "@hestiacp/lib";
import { getT, hestia, requireSession } from "@/lib/panel";
import { loginAsAction } from "@/app/session/actions";
import { toggleSuspendAction } from "./actions";

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireSession();
	// While impersonating, the panel's home is the looked user's account —
	// the list belongs to the admin's un-impersonated view (as in PHP).
	if (session.data.look) {
		redirect(`/users/${encodeURIComponent(String(session.data.look))}`);
	}
	const query = await searchParams;
	const t = await getT();
	const isAdmin = session.data.userContext === "admin";
	const token = String(session.data.token ?? "");
	let users: Record<string, HestiaUser>;
	try {
		users = await hestia.listUsers();
	} catch (error) {
		return (
			<div className="card">
				<h1>{t("Users")}</h1>
				<p className="error">
					Could not reach the Hestia command layer:{" "}
					{error instanceof Error ? error.message : String(error)}
				</p>
			</div>
		);
	}
	const names = Object.keys(users).sort();
	return (
		<div>
			<h1>{t("Users")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{isAdmin ? (
				<p>
					<Link className="button button-secondary" href="/add/user">
						<i className="fas fa-circle-plus icon-green"></i>
						{t("Add User")}
					</Link>
				</p>
			) : null}
			<table className="grid">
				<thead>
					<tr>
						<th>{t("User")}</th>
						<th>{t("Name")}</th>
						<th>{t("Package")}</th>
						<th>{t("Web Domains")}</th>
						<th>{t("DNS")}</th>
						<th>{t("Mail Domains")}</th>
						<th>{t("Databases")}</th>
						<th>{t("Cron Jobs")}</th>
						<th>{t("Suspended")}</th>
						{isAdmin ? <th>{t("Actions")}</th> : null}
					</tr>
				</thead>
				<tbody>
					{names.map((name) => {
						const u = users[name];
						const suspended = u.SUSPENDED === "yes";
						return (
							<tr key={name}>
								<td>
									<Link href={`/users/${encodeURIComponent(name)}`}>{name}</Link>
								</td>
								<td>{u.NAME}</td>
								<td>{u.PACKAGE}</td>
								<td>{u.WEB_DOMAINS}</td>
								<td>{u.DNS_DOMAINS}</td>
								<td>{u.MAIL_DOMAINS}</td>
								<td>{u.DATABASES}</td>
								<td>{u.CRON_JOBS}</td>
								<td>{u.SUSPENDED}</td>
								{isAdmin ? (
									<td>
										<form action={toggleSuspendAction} style={{ display: "inline" }}>
											<input type="hidden" name="user" value={name} />
											<input type="hidden" name="token" value={token} />
											<input type="hidden" name="op" value={suspended ? "unsuspend" : "suspend"} />
											<RowActionButton
												title={suspended ? t("Unsuspend") : t("Suspend")}
												icon={suspended ? "fa-play icon-green" : "fa-pause icon-highlight"}
											/>
										</form>
										{name !== session.data.user ? (
											<form action={loginAsAction} style={{ display: "inline" }}>
												<input type="hidden" name="user" value={name} />
												<input type="hidden" name="token" value={token} />
												<RowActionButton
													title={t("Log In As")}
													icon="fa-right-to-bracket icon-green"
												/>
											</form>
										) : null}{" "}
										<RowAction
											href={`/users/${encodeURIComponent(name)}/delete`}
											title={t("Delete")}
											icon="fa-trash icon-red"
										/>
									</td>
								) : null}
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
