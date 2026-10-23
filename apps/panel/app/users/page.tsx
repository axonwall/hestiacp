import Link from "next/link";
import { hestia, requireSession } from "@/lib/panel";

export default async function UsersPage() {
	await requireSession();
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
					</tr>
				</thead>
				<tbody>
					{names.map((name) => {
						const u = users[name];
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
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
