import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, sessions } from "@/lib/panel";

/** POST /logout — destroys the server-side session and clears the cookie. */
export async function POST() {
	const jar = await cookies();
	const id = await sessions.idFromCookie(jar.get(SESSION_COOKIE)?.value);
	if (id) {
		await sessions.destroy(id);
	}
	jar.delete(SESSION_COOKIE);
	redirect("/login");
}
