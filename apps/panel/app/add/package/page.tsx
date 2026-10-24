import Link from "next/link";
import { hestia, requireAdmin } from "@/lib/panel";
import { PackageFormFields } from "@/app/packages/package-form";
import { addPackageAction } from "./actions";

/** Add package — the form starts from the `default` package's values,
 *  like the PHP form's defaults, and the name is chosen on this page. */
export default async function AddPackagePage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await requireAdmin();
	const query = await searchParams;
	const token = String(session.data.token ?? "");
	const defaults = await hestia
		.listUserPackage("default")
		.catch(() => ({}) as Record<string, string>);
	return (
		<div>
			<h1>Add package</h1>
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error === "missing" ? (
				<p className="error">A package name is required.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<form action={addPackageAction}>
					<label htmlFor="name">Package name</label>
					<input className="form-control" id="name" name="name" required autoComplete="off" />
					<PackageFormFields
						values={defaults}
						token={token}
						submitLabel="Create package"
					/>
				</form>
			</div>
			<p>
				<Link href="/packages">Back to packages</Link>
			</p>
		</div>
	);
}
