import { NextResponse } from "next/server";
import { RRD_PERIODS } from "@hestiacp/lib";
import { getSession, hestia } from "@/lib/panel";

/**
 * POST /api/rrd — the Next equivalent of PHP /list/rrd/ajax.php: runs
 * v-export-rrd for one chart and stamps the unit PHP's unit map assigns
 * to that service. Admin-only, like the PHP endpoint (which redirects
 * non-admins to /list/user/).
 */
const SERVICE_UNITS: Record<string, string> = {
	la: "Points",
	mem: "Mbytes",
	apache2: "Connections",
	nginx: "Connections",
	mail: "Queue Size",
	ftp: "Connections",
	ssh: "Connections",
};

function unitFor(service: string): string | null {
	if (SERVICE_UNITS[service]) return SERVICE_UNITS[service];
	if (service.startsWith("net_")) return "KBytes";
	if (service.startsWith("pgsql_") || service.startsWith("mysql_")) return "Queries";
	return null;
}

export async function POST(request: Request) {
	const session = await getSession();
	if (session?.data.userContext !== "admin") {
		return NextResponse.json({ error: "forbidden" }, { status: 403 });
	}
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return NextResponse.json({ error: "bad request" }, { status: 400 });
	}
	const service = (body as { service?: unknown }).service;
	const period = (body as { period?: unknown }).period;
	if (typeof service !== "string" || typeof period !== "string") {
		return NextResponse.json({ error: "bad request" }, { status: 400 });
	}
	if (!(RRD_PERIODS as readonly string[]).includes(period)) {
		return NextResponse.json({ error: "bad request" }, { status: 400 });
	}
	try {
		const data = await hestia.exportRrd(service, period);
		return NextResponse.json({ ...data, service, unit: unitFor(service) });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : String(error) },
			{ status: 500 },
		);
	}
}
