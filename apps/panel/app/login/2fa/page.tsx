import { redirect } from "next/navigation";
import { getSession, getT } from "@/lib/panel";
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
	const t = await getT();
	return (
		<div className="login">
			<a href="/" className="u-block u-mb40">
				<img src="/images/logo.svg" alt="HestiaCP" width="100" height="120" />
			</a>
			<form action={twofaAction}>
				<h1 className="login-title">{t("Two-factor authentication")}</h1>
				<p>
					Enter the 6-digit code from your authenticator app for {String(session.data.pending_user)}
					.
				</p>
				{query.error ? <p className="error">{t("Invalid or missing 2FA token")}</p> : null}
				<div className="u-mb20">
					<label htmlFor="twofa" className="form-label">
						{t("Authentication code")}
					</label>
					<input
						id="twofa"
						name="twofa"
						className="form-control"
						inputMode="numeric"
						autoComplete="one-time-code"
						required
					/>
				</div>
				<button type="submit" className="button">
					<i className="fas fa-key"></i>
					{t("Verify")}
				</button>
			</form>
		</div>
	);
}
