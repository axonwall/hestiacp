import { type NextRequest, NextResponse } from "next/server";

/**
 * Next 16 proxy (formerly middleware): a cheap first gate that bounces
 * requests without a session cookie to /login. This checks cookie *presence*
 * only — every page and action re-validates the session server-side via
 * @hestiacp/lib's SessionStore before doing any work.
 */
export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isPublic =
		pathname === "/login" ||
		pathname.startsWith("/api/health") ||
		pathname.startsWith("/_next");
	if (isPublic) {
		return NextResponse.next();
	}
	if (!request.cookies.has("HESTIANGSID")) {
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
