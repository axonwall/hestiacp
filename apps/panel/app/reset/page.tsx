import Link from "next/link";
import { getT } from "@/lib/panel";
import { completeResetAction, requestResetAction } from "./actions";

/**
 * Password reset (web/reset/index.php + login/reset_*.php):
 *  no ?action= — the username + email request form;
 *  ?action=code&user= — the reset-code form (a GET form, as
 *  PHP's is, landing on the password form);
 *  ?action=confirm&user=&code= — the new-password form.
 * Unauthenticated by design; the proxy gate lists /reset public.
 */
export default async function ResetPage({
	searchParams,
}: {
	searchParams: Promise<{
		action?: string;
		user?: string;
		code?: string;
		error?: string;
		sent?: string;
	}>;
}) {
	const query = await searchParams;
	const t = await getT();
	const user = query.user ?? "";
	const code = query.code ?? "";
	return (
		<div className="login">
			<a href="/" className="u-block u-mb40">
				<img src="/images/logo.svg" alt="HestiaCP" width="100" height="120" />
			</a>
			<h1 className="login-title">{t("Forgot Password")}</h1>
			{query.sent ? (
				<p>
					{t(
						"Password reset instructions have been sent to the email address associated with this account.",
					)}
				</p>
			) : null}
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.action === "code" && user ? (
				<form method="get" action="/reset">
					<input type="hidden" name="action" value="confirm" />
					<input type="hidden" name="user" value={user} />
					<div className="u-mb20">
						<label htmlFor="code" className="form-label">
							{t("Reset Code")}
						</label>
						<input type="text" className="form-control" name="code" id="code" required />
					</div>
					<button type="submit" className="button">
						{t("Confirm")}
					</button>
					<Link href="/login" className="button button-secondary">
						{t("Back")}
					</Link>
				</form>
			) : query.action === "confirm" && user && code ? (
				<form action={completeResetAction}>
					<input type="hidden" name="user" value={user} />
					<input type="hidden" name="code" value={code} />
					<div className="u-mb20">
						<label htmlFor="password" className="form-label">
							{t("New Password")}
						</label>
						<input
							type="password"
							className="form-control"
							name="password"
							id="password"
							autoComplete="new-password"
							required
						/>
					</div>
					<div className="u-mb20">
						<label htmlFor="password_confirm" className="form-label">
							{t("Confirm Password")}
						</label>
						<input
							type="password"
							className="form-control"
							name="password_confirm"
							id="password_confirm"
							autoComplete="new-password"
							required
						/>
					</div>
					<button type="submit" className="button">
						{t("Confirm")}
					</button>
					<Link href="/login" className="button button-secondary">
						{t("Back")}
					</Link>
				</form>
			) : (
				<form action={requestResetAction}>
					<div className="u-mb20">
						<label htmlFor="username" className="form-label">
							{t("Username")}
						</label>
						<input
							type="text"
							className="form-control"
							name="user"
							id="username"
							autoComplete="username"
							required
						/>
					</div>
					<div className="u-mb20">
						<label htmlFor="email" className="form-label">
							{t("Email")}
						</label>
						<input
							type="email"
							className="form-control"
							name="email"
							id="email"
							autoComplete="email"
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
