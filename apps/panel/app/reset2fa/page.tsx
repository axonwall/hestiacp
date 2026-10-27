import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession, getT } from "@/lib/panel";
import { reset2faAction } from "./actions";

/**
 * 2FA reset (web/reset2fa/ + web/templates/pages/login/reset2fa.php):
 * username + 2FA reset code form, or the unlocked confirmation.
 * Unauthenticated only; logged-in and mid-login (pending 2FA)
 * sessions are sent home, matching PHP's redirect for set users.
 */
export default async function Reset2faPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; unlocked?: string }>;
}) {
	const session = await getSession();
	if (session?.data.user || session?.data.pending_user) {
		redirect("/users");
	}
	const query = await searchParams;
	const t = await getT();
	return (
		<div className="login">
			<a href="/" className="u-block u-mb40">
				<img src="/images/logo.svg" alt="HestiaCP" width="100" height="120" />
			</a>
			{query.unlocked ? (
				<div>
					<h1 className="login-title">{t("Account Unlocked")}</h1>
					<p>
						{t(
							"Two-factor authentication is now turned off for your account. You may now proceed to log in.",
						)}
					</p>
					<Link href="/login" className="button">
						{t("Log in")}
					</Link>
				</div>
			) : (
				<form action={reset2faAction}>
					<h1 className="login-title">{t("Unlock Account")}</h1>
					{query.error ? <p className="error">{t("Invalid username or 2FA reset code.")}</p> : null}
					<div className="u-mb20">
						<label htmlFor="user" className="form-label">
							{t("Username")}
						</label>
						<input
							type="text"
							className="form-control"
							name="user"
							id="user"
							autoComplete="username"
							required
						/>
					</div>
					<div className="u-mb20">
						<label htmlFor="twofa" className="form-label">
							{t("2FA Reset Code")}
						</label>
						<input
							type="text"
							className="form-control"
							name="twofa"
							id="twofa"
							autoComplete="off"
							required
						/>
					</div>
					<button type="submit" className="button">
						{t("Submit")}
					</button>
					<Link href="/login" className="button button-secondary">
						{t("Back")}
					</Link>
				</form>
			)}
		</div>
	);
}
