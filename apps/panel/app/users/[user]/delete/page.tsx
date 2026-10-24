import Link from "next/link";
import { hestia, requireAdmin } from "@/lib/panel";
import { deleteUserAction } from "./actions";

export default async function DeleteUserPage({
	params,
	searchParams,
}: {
	params: Promise<{ user: string }>;
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const { user } = await params;
	const query = await searchParams;
	const username = decodeURIComponent(user);
	const token = String(session.data.token ?? "");
	const record = await hestia.listUser(username).catch(() => null);
	return (
		<div>
			<h1>Delete user {username}</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error === "protected" ? (
				<p className="error">
					Your own account and the root user cannot be deleted here.
				</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<p>
					This permanently deletes the account
					{record ? ` (${record.NAME}, package ${record.PACKAGE})` : ""} with
					all of its web, DNS, mail and database content. There is no undo.
				</p>
				<form action={deleteUserAction}>
					<input type="hidden" name="user" value={username} />
					<input type="hidden" name="token" value={token} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> I understand
						this deletes {username} permanently
					</label>
					<button type="submit" className="button">
						Delete user
					</button>
				</form>
			</div>
			<p>
				<Link href={`/users/${encodeURIComponent(username)}`}>
					Back to user
				</Link>
			</p>
		</div>
	);
}
