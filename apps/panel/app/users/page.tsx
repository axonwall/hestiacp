import Link from "next/link";
import { hestia, requireSession } from "@/lib/panel";
import { toggleSuspendAction } from "./actions";

export default async function UsersPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireSession();
	const query = await searchParams;
	const isAdmin = session.data.userContext === "admin";
	const token = String(session.data.token ?? "");
	let users;
	try {
		users = await hestia.listUsers();
	} catch (error) {
		return (
			<div className="card">
				<h1>Users</h1>
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
			<h1>Users</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{isAdmin ? (
				<p>
					<Link className="button" href="/add/user">
						Add user
					</Link>
				</p>
			) : null}
			<table className="grid">
				<thead>
					<tr>
						<th>User</th>
						<th>Name</th>
						<th>Package</th>
						<th>Web</th>
						<th>DNS</th>
						<th>Mail</th>
						<th>DB</th>
						<th>Cron</th>
						<th>Suspended</th>
						{isAdmin ? <th>Actions</th> : null}
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
												{suspended ? "Unsuspend" : "Suspend"}
											</button>
										</form>{" "}
										<Link
											href={`/users/${encodeURIComponent(name)}/delete`}
										>
											Delete
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
