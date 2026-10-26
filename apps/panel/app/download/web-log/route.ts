import { effectiveUser, hestia, requireSession } from "@/lib/panel";

/**
 * Log download (web/download/web-log): PHP streams the command
 * output directly (5000-line limit) as an attachment; this route
 * returns the same bytes with the same filename and CSRF check.
 */
export async function GET(request: Request) {
	const session = await requireSession();
	const url = new URL(request.url);
	const domain = url.searchParams.get("domain") ?? "";
	const type = url.searchParams.get("type") === "error" ? "error" : "access";
	const token = url.searchParams.get("token") ?? "";
	if (!domain || domain.includes("/") || domain.includes("..")) {
		return new Response("Bad domain", { status: 400 });
	}
	if (token !== String(session.data.token ?? "")) {
		return new Response("Forbidden", { status: 403 });
	}
	const user = effectiveUser(session);
	let lines: string;
	try {
		lines = await hestia.listWebDomainLog(user, domain, type, "5000");
	} catch (error) {
		return new Response(error instanceof Error ? error.message : String(error), {
			status: 500,
		});
	}
	return new Response(lines, {
		headers: {
			"content-type": "application/octet-stream",
			"content-disposition": `attachment; filename="${domain}.${type}-log.txt"`,
		},
	});
}
