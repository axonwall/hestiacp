import Link from "next/link";
import { hestia, requireAdmin } from "@/lib/panel";
import { PackageFormFields } from "../package-form";
import { editPackageAction } from "./actions";

export default async function PackageDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ name: string }>;
	searchParams: Promise<{ saved?: string; error?: string }>;
}) {
	const session = await requireAdmin();
	const { name } = await params;
	const query = await searchParams;
	const packageName = decodeURIComponent(name);
	const token = String(session.data.token ?? "");
	let record;
	try {
		record = await hestia.listUserPackage(packageName);
	} catch {
		return (
			<div className="card">
				<h1>Package not found</h1>
				<p className="error">No such package: {packageName}</p>
				<p>
					<Link href="/packages">Back to packages</Link>
				</p>
			</div>
		);
	}
	return (
		<div>
			<h1>Package {packageName}</h1>
			{query.saved ? <p className="card">Saved.</p> : null}
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<form action={editPackageAction}>
					<input type="hidden" name="name" value={packageName} />
					<PackageFormFields
						values={record}
						token={token}
						submitLabel="Save package"
					/>
				</form>
			</div>
			<p>
				<Link href="/packages">Back to packages</Link>
				{" · "}
				<Link href={`/packages/${encodeURIComponent(packageName)}/delete`}>
					Delete package
				</Link>
			</p>
		</div>
	);
}
