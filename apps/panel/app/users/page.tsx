import Link from "next/link";
import { redirect } from "next/navigation";
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
	let users;
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
					<Link className="button" href="/add/user">
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
									<Link href={`/users/${encodeURIComponent(name)}`}>
										{name}
									</Link>
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
										<form
											action={toggleSuspendAction}
											style={{ display: "inline" }}
										>
											<input type="hidden" name="user" value={name} />
											<input type="hidden" name="token" value={token} />
											<input
												type="hidden"
												name="op"
												value={suspended ? "unsuspend" : "suspend"}
											/>
											<button type="submit" className="link-button">
												{suspended ? t("Unsuspend") : t("Suspend")}
											</button>
										</form>{" "}
										{name !== session.data.user ? (
											<form
												action={loginAsAction}
												style={{ display: "inline" }}
											>
												<input type="hidden" name="user" value={name} />
												<input type="hidden" name="token" value={token} />
												<button type="submit" className="link-button">
													{t("Log In As")}
												</button>
											</form>
										) : null}{" "}
										<Link
											href={`/users/${encodeURIComponent(name)}/delete`}
										>
											{t("Delete")}
										</Link>
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
