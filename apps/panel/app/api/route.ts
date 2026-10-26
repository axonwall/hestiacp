import { handleApiRequest, type ApiRequestData } from "@hestiacp/lib";
import { hestia } from "@/lib/panel";

/**
 * POST /api — the legacy HestiaCP API endpoint (D4: hard compatibility
 * requirement). All semantics live in @hestiacp/lib's dispatcher; this
 * adapter only decodes the request body (form-encoded, or JSON when the
 * client sends it) and maps the result onto a Response with the
 * Hestia-Exit-Code header.
 */
export async function POST(request: Request) {
	const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "127.0.0.1";
	const text = await request.text();
	const data: ApiRequestData = {};

	const contentType = request.headers.get("content-type") ?? "";
	if (contentType.includes("application/json") || text.trim().startsWith("{")) {
		try {
			const parsed = JSON.parse(text) as Record<string, unknown>;
			for (const [k, v] of Object.entries(parsed)) {
				if (v !== null && v !== undefined) data[k] = String(v);
			}
		} catch {
			// Fall through with no fields; the dispatcher answers E_INVALID.
		}
	} else {
		for (const [k, v] of new URLSearchParams(text)) {
			data[k] = v;
		}
	}

	const result = await handleApiRequest(hestia, data, ip);
	return new Response(result.body, {
		status: result.httpStatus,
		headers: {
			"Hestia-Exit-Code": String(result.exitCode),
			"Content-Type": "text/plain; charset=utf-8",
		},
	});
}
