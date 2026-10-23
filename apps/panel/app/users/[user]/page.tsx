import Link from "next/link";
import { hestia, requireSession } from "@/lib/panel";
import { editNameAction } from "./edit/actions";

export default async function UserDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ user: string }>;
	searchParams: Promise<{ saved?: string; error?: string }>;
}) {
	const session = await requireSession();
	const { user } = await params;
	const query = await searchParams;
	const username = decodeURIComponent(user);

	let record;
	try {
		record = await hestia.listUser(username);
	} catch {
		return (
			<div className="card">
				<h1>User not found</h1>
				<p className="error">No such user: {username}</p>
				<p>
					<Link href="/users">Back to users</Link>
				</p>
			</div>
		);
	}

	const [firstName, ...rest] = (record.NAME ?? "").split(" ");
	const lastName = rest.join(" ");

	return (
		<div>
			<h1>{username}</h1>
			{query.saved ? <p className="card">Saved.</p> : null}
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error ? (
				<p className="error">First name must not be empty.</p>
			) : null}
			<div className="card">
				<dl className="fields">
					<dt>Name</dt>
					<dd>{record.NAME}</dd>
					<dt>Package</dt>
					<dd>{record.PACKAGE}</dd>
					<dt>Web domains</dt>
					<dd>{record.WEB_DOMAINS}</dd>
					<dt>DNS domains</dt>
					<dd>{record.DNS_DOMAINS}</dd>
					<dt>Mail domains</dt>
					<dd>{record.MAIL_DOMAINS}</dd>
					<dt>Databases</dt>
					<dd>{record.DATABASES}</dd>
					<dt>Cron jobs</dt>
					<dd>{record.CRON_JOBS}</dd>
					<dt>Disk quota</dt>
					<dd>{record.DISK_QUOTA}</dd>
					<dt>Suspended</dt>
					<dd>{record.SUSPENDED}</dd>
				</dl>
			</div>
			<div className="card" style={{ marginTop: "1rem" }}>
				<h2>Edit name</h2>
				<form action={editNameAction}>
					<input type="hidden" name="user" value={username} />
					<input
						type="hidden"
						name="token"
						value={String(session.data.token ?? "")}
					/>
					<label htmlFor="firstName">First name</label>
					<input id="firstName" name="firstName" defaultValue={firstName} required />
					<label htmlFor="lastName">Last name</label>
					<input id="lastName" name="lastName" defaultValue={lastName} />
					<button type="submit" className="primary">
						Save
					</button>
				</form>
			</div>
			<p>
				<Link href="/users">Back to users</Link>
			</p>
		</div>
	);
}
