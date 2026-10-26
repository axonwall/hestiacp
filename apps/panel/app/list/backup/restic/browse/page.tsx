import { notFound } from "next/navigation";
import type { ResticFileEntry } from "@hestiacp/lib";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import { restoreResticFileAction, restoreResticSelectedAction } from "./actions";

const TYPE_LABELS: Record<string, string> = {
	dir: "Directory",
	file: "File",
	symlink: "Symlink",
};

/**
 * Browse a restic snapshot's files (web/list/backup/incremental with
 * &browse=yes): entries of v-list-user-files-restic; directories
 * navigate deeper except under the account's conf/ directory, which
 * PHP renders unlinked. Each entry restores via the typed "file"
 * schedule shape; checkboxes restore in bulk.
 */
export default async function ResticBrowsePage({
	searchParams,
}: {
	searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const snapshot = String(query.snapshot ?? "");
	if (!snapshot) notFound();
	const user = effectiveUser(session);
	const home = `/home/${user}`;
	const folder = String(query.folder ?? home) || home;
	const token = String(session.data.token ?? "");
	const error = typeof query.error === "string" ? query.error : undefined;
	const notice = typeof query.notice === "string" ? query.notice : undefined;

	let files: ResticFileEntry[] = [];
	let loadError: string | undefined;
	try {
		({ files } = await hestia.listUserFilesRestic(user, snapshot, folder));
	} catch (e) {
		files = [];
		loadError = e instanceof Error ? e.message : String(e);
	}
	const entries = files.filter((f) => f.path !== folder);
	const parent = folder.slice(0, folder.lastIndexOf("/")) || "/";
	const browseUrl = (f: string) =>
		`/list/backup/restic/browse?snapshot=${encodeURIComponent(snapshot)}&folder=${encodeURIComponent(f)}`;

	return (
		<div className="card">
			<h1>
				{t("Files")} — {snapshot}
			</h1>
			<p className="muted">{folder}</p>
			{error || loadError ? <p className="error">{error ?? loadError}</p> : null}
			{notice === "scheduled" ? <p>{t("Restore scheduled")}</p> : null}
			<p>
				<a href={`/list/backup/restic/detail?snapshot=${encodeURIComponent(snapshot)}`}>
					{t("Back")}
				</a>
				{folder !== home ? (
					<>
						{" · "}
						<a href={browseUrl(parent)}>..</a>
					</>
				) : null}
			</p>
			<table>
				<thead>
					<tr>
						<th></th>
						<th>{t("Name")}</th>
						<th>{t("Type")}</th>
						<th>{t("Date")}</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{entries.map((file) => {
						const navigable = file.type === "dir" && !file.path.startsWith(`${home}/conf`);
						return (
							<tr key={file.path}>
								<td>
									<input type="checkbox" name="files" value={file.path} form="bulk-restore" />
								</td>
								<td>{navigable ? <a href={browseUrl(file.path)}>{file.name}</a> : file.name}</td>
								<td>{TYPE_LABELS[file.type] ?? "Unknown"}</td>
								<td>{(file.mtime ?? "").slice(0, 19).replace("T", " ")}</td>
								<td>
									<form action={restoreResticFileAction}>
										<input type="hidden" name="token" value={token} />
										<input type="hidden" name="snapshot" value={snapshot} />
										<input type="hidden" name="folder" value={folder} />
										<input type="hidden" name="path" value={file.path} />
										<button type="submit">{t("Restore")}</button>
									</form>
								</td>
							</tr>
						);
					})}
				</tbody>
			</table>
			<form id="bulk-restore" action={restoreResticSelectedAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="snapshot" value={snapshot} />
				<input type="hidden" name="folder" value={folder} />
				<button type="submit">{t("Restore selected")}</button>
			</form>
		</div>
	);
}
