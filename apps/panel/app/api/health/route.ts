import { NextResponse } from "next/server";
import { hestia } from "@/lib/panel";

/**
 * GET /api/health — proves the route-handler path and reports whether the
 * Hestia command layer answers (via v-list-sys-config).
 */
export async function GET() {
	try {
		const sys = await hestia.listSysConfig();
		return NextResponse.json({
			status: "ok",
			hestiaVersion: sys.config?.VERSION ?? "unknown",
		});
	} catch (error) {
		return NextResponse.json(
			{
				status: "backend-unreachable",
				error: error instanceof Error ? error.message : String(error),
			},
			{ status: 503 },
		);
	}
}
