import Link from "next/link";
import { requireAdmin } from "@/lib/panel";
import { deletePackageAction } from "./actions";

export default async function DeletePackagePage({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const { name } = await params;
	const query = await searchParams;
	const packageName = decodeURIComponent(name);
	const token = String(session.data.token ?? "");
	return (
		<div>
			<h1>Delete package {packageName}</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<p>
					Deletes the package definition. Users currently on this package
					keep their existing resources, but the command refuses while the
					package is still assigned.
				</p>
				<form action={deletePackageAction}>
					<input type="hidden" name="name" value={packageName} />
					<input type="hidden" name="token" value={token} />
					<label>
						<input type="checkbox" name="confirm" value="yes" /> I understand
					</label>
					<button type="submit" className="primary">
						Delete package
					</button>
				</form>
			</div>
			<p>
				<Link href={`/packages/${encodeURIComponent(packageName)}`}>
					Back to package
				</Link>
			</p>
		</div>
	);
}
