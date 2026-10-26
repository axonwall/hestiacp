import { requireSession } from "@/lib/panel";
import { jobStore } from "@/lib/jobs";

/**
 * Background jobs (installs and other long work): the persisted
 * records from the lib's JobStore — status, timing, and the failure
 * message when a job failed.
 */
export default async function JobsPage({
	searchParams,
}: {
	searchParams: Promise<{ job?: string }>;
}) {
	await requireSession();
	const { job } = await searchParams;
	const jobs = await jobStore().list();
	return (
		<div className="card">
			<h1>Jobs</h1>
			{jobs.length === 0 ? (
				<p>No jobs yet.</p>
			) : (
				<table>
					<thead>
						<tr>
							<th>Job</th>
							<th>Status</th>
							<th>Started</th>
							<th>Finished</th>
							<th>Detail</th>
						</tr>
					</thead>
					<tbody>
						{jobs.map((j) => (
							<tr key={j.id} className={j.id === job ? "highlight" : undefined}>
								<td>{j.name}</td>
								<td>{j.status}</td>
								<td>{j.startedAt}</td>
								<td>{j.finishedAt ?? "—"}</td>
								<td>
									{j.error ??
										(j.meta
											? Object.entries(j.meta)
													.map(([k, v]) => `${k}: ${v}`)
													.join(" · ")
											: "")}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
