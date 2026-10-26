import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename, join } from "node:path";
import { Readable } from "node:stream";
import { effectiveUser, hestia, requireSession } from "@/lib/panel";

/**
 * Backup download (web/download/backup): PHP hands existing files to
 * nginx via X-Accel-Redirect; the standalone panel streams the file
 * itself with the same access rule (admin: any backup; users: only
 * files prefixed with their own username). When the archive is not
 * local yet (remote store), it schedules the download and sends the
 * user back to the list, as PHP does.
 */
export async function GET(request: Request) {
	const session = await requireSession();
	const url = new URL(request.url);
	const backup = basename(url.searchParams.get("backup") ?? "");
	if (!backup) {
		return Response.redirect(new URL("/list/backup?error=missing", url), 303);
	}
	const admin = session.data.userContext === "admin";
	const user = effectiveUser(session);
	if (
		!admin &&
		!backup.startsWith(`${String(session.data.user)}.`) &&
		!backup.startsWith(`${user}.`)
	) {
		return new Response("Forbidden", { status: 403 });
	}
	const dir = process.env.HESTIA_BACKUP_DIR ?? "/backup";
	const path = join(dir, backup);
	const info = await stat(path).catch(() => null);
	if (!info?.isFile()) {
		await hestia.scheduleUserBackupDownload(user, backup).catch(() => undefined);
		return Response.redirect(new URL("/list/backup?notice=scheduled", url), 303);
	}
	const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
	return new Response(stream, {
		headers: {
			"content-type": "application/gzip",
			"content-length": String(info.size),
			"content-disposition": `attachment; filename="${backup}"`,
		},
	});
}
