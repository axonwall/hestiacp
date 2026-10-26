import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { effectiveUser, hestia, requireSession } from "@/lib/panel";

/**
 * Database download (web/download/database): PHP hands the
 * v-dump-database archive to nginx via X-Accel-Redirect; the
 * standalone panel streams the file itself, after the same CSRF
 * token check PHP applies to the GET link. PHP sends the full
 * archive path as the filename; this sends just its basename.
 */
export async function GET(request: Request) {
	const session = await requireSession();
	const url = new URL(request.url);
	const database = basename(url.searchParams.get("database") ?? "");
	const token = url.searchParams.get("token") ?? "";
	if (!database) {
		return Response.redirect(new URL("/list/db?error=missing", url), 303);
	}
	if (token !== String(session.data.token ?? "")) {
		return new Response("Forbidden", { status: 403 });
	}
	const user = effectiveUser(session);
	let path: string;
	try {
		path = await hestia.dumpDatabase(user, database);
	} catch (error) {
		return new Response(error instanceof Error ? error.message : String(error), {
			status: 500,
		});
	}
	const info = await stat(path).catch(() => null);
	if (!info?.isFile()) {
		return new Response("Dump not found", { status: 404 });
	}
	const stream = Readable.toWeb(createReadStream(path)) as ReadableStream;
	return new Response(stream, {
		headers: {
			"content-type": "application/sql",
			"content-length": String(info.size),
			"content-disposition": `attachment; filename="${basename(path)}"`,
		},
	});
}
