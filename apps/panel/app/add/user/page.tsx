import Link from "next/link";
import { hestia, requireAdmin } from "@/lib/panel";
import { addUserAction } from "./actions";

export default async function AddUserPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	const [packages, languages] = await Promise.all([
		hestia.listUserPackages().catch(() => ({}) as Record<string, unknown>),
		hestia.listSysLanguages().catch(() => [] as string[]),
	]);
	const packageNames = Object.keys(packages).sort();
	return (
		<div>
			<h1>Add user</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "missing" ? (
				<p className="error">Username, password, email and name are required.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<form action={addUserAction}>
					<input type="hidden" name="token" value={token} />
					<label htmlFor="user">Username</label>
					<input className="form-control" id="user" name="user" required autoComplete="off" />
					<label htmlFor="secret">Password</label>
					<input
						className="form-control"
						id="secret"
						name="secret"
						type="password"
						required
						autoComplete="new-password"
					/>
					<label htmlFor="email">Email</label>
					<input className="form-control" id="email" name="email" type="email" required />
					<label htmlFor="notifyEmail">Email login credentials to:</label>
					<input className="form-control" id="notifyEmail" name="notifyEmail" type="email" />
					<label htmlFor="name">Full name</label>
					<input className="form-control" id="name" name="name" required />
					<label htmlFor="package">Package</label>
					<select className="form-select" id="package" name="package" defaultValue="default">
						{packageNames.map((name) => (
							<option key={name} value={name}>
								{name}
							</option>
						))}
					</select>
					<label htmlFor="language">Language</label>
					<select className="form-select" id="language" name="language" defaultValue="en">
						{languages.map((lang) => (
							<option key={lang} value={lang}>
								{lang}
							</option>
						))}
					</select>
					<label htmlFor="role">Role</label>
					<select className="form-select" id="role" name="role" defaultValue="user">
						<option value="user">User</option>
						<option value="admin">Administrator</option>
					</select>
					<label>
						<input type="checkbox" name="loginDisabled" value="yes" /> Disable login
					</label>
					<button type="submit" className="button">
						Create user
					</button>
				</form>
			</div>
			<p>
				<Link href="/users">Back to users</Link>
			</p>
		</div>
	);
}
