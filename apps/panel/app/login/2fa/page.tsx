import { redirect } from "next/navigation";
import { getSession } from "@/lib/panel";
import { twofaAction } from "./actions";

/** Step 2 of login: the TOTP code form. Only reachable with a pending
 *  session from the password step; anything else goes back to /login. */
export default async function TwofaPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const session = await getSession();
	if (!session?.data.pending_user) {
		redirect("/login");
	}
	const query = await searchParams;
	return (
		<div className="card login-card">
			<h1>Two-factor authentication</h1>
			<p>
				Enter the 6-digit code from your authenticator app for{" "}
				{String(session.data.pending_user)}.
			</p>
			{query.error ? (
				<p className="error">Invalid or missing 2FA token.</p>
			) : null}
			<form action={twofaAction}>
				<label htmlFor="twofa">Authentication code</label>
				<input
					id="twofa"
					name="twofa"
					inputMode="numeric"
					autoComplete="one-time-code"
					required
				/>
				<button type="submit" className="primary">
					Verify
				</button>
			</form>
		</div>
	);
}
