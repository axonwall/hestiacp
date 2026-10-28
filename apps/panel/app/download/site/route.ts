import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { basename } from "node:path";
import { Readable } from "node:stream";
import { effectiveUser, hestia, requireSession } from "@/lib/panel";

/**
 * Site download (web/download/site): PHP hands the v-dump-site
 * archive to nginx via X-Accel-Redirect; the standalone panel
 * streams the file itself, after the same CSRF token check PHP
 * applies to the GET link.
 */
export async function GET(request: Request) {
	const session = await requireSession();
	const url = new URL(request.url);
	const site = basename(url.searchParams.get("site") ?? "");
	const token = url.searchParams.get("token") ?? "";
	if (!site) {
		return Response.redirect(new URL("/list/web?error=missing", url), 303);
	}
	if (token !== String(session.data.token ?? "")) {
		return new Response("Forbidden", { status: 403 });
	}
	const user = effectiveUser(session);
	let dump: Awaited<ReturnType<typeof hestia.dumpSite>>;
	try {
		dump = await hestia.dumpSite(user, site);
	} catch (error) {
		return new Response(error instanceof Error ? error.message : String(error), {
			status: 500,
		});
	}
	const info = await stat(dump.path).catch(() => null);
	if (!info?.isFile()) {
		return new Response("Dump not found", { status: 404 });
	}
	const stream = Readable.toWeb(createReadStream(dump.path)) as ReadableStream;
	return new Response(stream, {
		headers: {
			"content-type": "application/zip",
			"content-length": String(info.size),
			"content-disposition": `attachment; filename="${dump.filename}"`,
		},
	});
}
