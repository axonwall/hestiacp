import { getT } from "@/lib/panel";
import { loginAction } from "./actions";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const params = await searchParams;
	const t = await getT();
	return (
		<div className="card" style={{ maxWidth: 380, margin: "3rem auto" }}>
			<h1>{t("Log in")}</h1>
			{params.error ? (
				<p className="error">{t("Invalid username or password")}</p>
			) : null}
			<form action={loginAction}>
				<label htmlFor="user">{t("Username")}</label>
				<input id="user" name="user" autoComplete="username" required />
				<label htmlFor="secret">{t("Password")}</label>
				<input
					id="secret"
					name="secret"
					type="password"
					autoComplete="current-password"
					required
				/>
				<button type="submit" className="primary">
					{t("Log in")}
				</button>
			</form>
		</div>
	);
}
