import { getT } from "@/lib/panel";
import { loginAction } from "./actions";

/**
 * The login screen in the PHP template's structure
 * (web/templates/pages/login/): centered .login block, logo,
 * "Welcome to <APP_NAME>", labelled .form-control fields and a
 * .button submit. One form instead of PHP's two steps (username,
 * then password) — the flow difference is ours by design (D3).
 */
export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const params = await searchParams;
	const t = await getT();
	return (
		<div className="login">
			<a href="/" className="u-block u-mb40">
				<img src="/images/logo.svg" alt="HestiaCP" width="100" height="120" />
			</a>
			<form action={loginAction}>
				<h1 className="login-title">{t("Welcome to %s", "HestiaCP")}</h1>
				{params.error ? <p className="error">{t("Invalid username or password")}</p> : null}
				<div className="u-mb20">
					<label htmlFor="user" className="form-label">
						{t("Username")}
					</label>
					<input id="user" name="user" className="form-control" autoComplete="username" required />
				</div>
				<div className="u-mb20">
					<label htmlFor="secret" className="form-label">
						{t("Password")}
					</label>
					<input
						id="secret"
						name="secret"
						type="password"
						className="form-control"
						autoComplete="current-password"
						required
					/>
				</div>
				<button type="submit" className="button">
					<i className="fas fa-right-to-bracket"></i>
					{t("Log in")}
				</button>
			</form>
		</div>
	);
}
