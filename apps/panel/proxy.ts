import { type NextRequest, NextResponse } from "next/server";

/**
 * Next 16 proxy (formerly middleware): a cheap first gate that bounces
 * requests without a session cookie to /login. This checks cookie *presence*
 * only — every page and action re-validates the session server-side via
 * @hestiacp/lib's SessionStore before doing any work.
 */
export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	// /api does its own authentication (legacy API semantics) — no session gate.
	// The theme assets (Phase 6) are static files the login page itself
	// needs, so they bypass the gate like /_next does.
	const isPublic =
		pathname === "/login" ||
		pathname.startsWith("/api") ||
		pathname.startsWith("/_next") ||
		pathname.startsWith("/hestia/") ||
		pathname.startsWith("/webfonts/") ||
		pathname.startsWith("/images/");
	if (isPublic) {
		return NextResponse.next();
	}
	if (!request.cookies.has("HESTIASID")) {
		const login = request.nextUrl.clone();
		login.pathname = "/login";
		login.search = "";
		return NextResponse.redirect(login);
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
