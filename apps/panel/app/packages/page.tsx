import Link from "next/link";
import { hestia, requireAdmin } from "@/lib/panel";

export default async function PackagesPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	await requireAdmin();
	const query = await searchParams;
	let packages;
	try {
		packages = await hestia.listUserPackages();
	} catch (error) {
		return (
			<div className="card">
				<h1>Packages</h1>
				<p className="error">
					Could not reach the Hestia command layer:{" "}
					{error instanceof Error ? error.message : String(error)}
				</p>
			</div>
		);
	}
	const names = Object.keys(packages).sort();
	return (
		<div>
			<h1>Packages</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			<p>
				<Link className="button" href="/add/package">
					Add package
				</Link>
			</p>
			<table className="grid">
				<thead>
					<tr>
						<th>Package</th>
						<th>Web domains</th>
						<th>DNS domains</th>
						<th>Mail domains</th>
						<th>Databases</th>
						<th>Disk quota</th>
						<th>Bandwidth</th>
						<th>Shell</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{names.map((name) => {
						const p = packages[name];
						return (
							<tr key={name}>
								<td>
									<Link href={`/packages/${encodeURIComponent(name)}`}>
										{name}
									</Link>
								</td>
								<td>{p.WEB_DOMAINS}</td>
								<td>{p.DNS_DOMAINS}</td>
								<td>{p.MAIL_DOMAINS}</td>
								<td>{p.DATABASES}</td>
								<td>{p.DISK_QUOTA}</td>
								<td>{p.BANDWIDTH}</td>
								<td>{p.SHELL}</td>
								<td>
									<Link href={`/packages/${encodeURIComponent(name)}/delete`}>
										Delete
									</Link>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
		</div>
	);
}
