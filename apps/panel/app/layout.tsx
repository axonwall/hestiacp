import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession, getT } from "@/lib/panel";
import { returnToAdminAction } from "@/app/session/actions";
import "./globals.css";

export const metadata: Metadata = {
	title: "HestiaCP (Next.js panel)",
	description: "HestiaNG spike — HestiaCP panel rebuilt on Next.js",
};

export default async function RootLayout({
	children,
}: {
	children: ReactNode;
}) {
	const session = await getSession();
	const t = await getT();
	const isAdmin = session?.data.userContext === "admin";
	// Feature gates come from sys config in the session, exactly as the PHP
	// top bar reads them. (PHP also hides /fm/ while impersonating the
	// protected admin — impersonation itself is Phase 1 follow-up work.)
	const showFileManager = session?.data.FILE_MANAGER === "true";
	const showTerminal =
		session?.data.WEB_TERMINAL === "true" &&
		session?.data.login_shell !== "nologin";
	return (
		<html lang="en">
			<body>
				<header className="topbar">
					<span className="brand">HestiaCP</span>
					<span className="codename">Next.js panel · HestiaNG</span>
					{session ? (
						<a className="top-link" href="/users">
							{t("Users")}
						</a>
					) : null}
					{isAdmin ? (
						<a className="top-link" href="/packages">
							{t("Packages")}
						</a>
					) : null}
					{showFileManager ? (
						<a className="top-link" href="/fm/">
							{t("File Manager")}
						</a>
					) : null}
					{showTerminal ? (
						<a className="top-link" href="/list/terminal/">
							{t("Web Terminal")}
						</a>
					) : null}
					<span className="spacer" />
					{session ? (
						<>
							<span className="who">
								{String(session.data.look || session.data.user || "")}
							</span>
							<form action="/logout" method="post">
								<button type="submit" className="link-button">
									{t("Log out")}
								</button>
							</form>
						</>
					) : null}
				</header>
				{session?.data.look ? (
					<div className="impersonation-banner">
						<span>
							{t("Viewing as %s", String(session.data.look))}
						</span>
						<form action={returnToAdminAction}>
							<input
								type="hidden"
								name="token"
								value={String(session.data.token ?? "")}
							/>
							<button type="submit" className="link-button">
								{t("Return to admin")}
							</button>
						</form>
					</div>
				) : null}
				<main className="content">{children}</main>
			</body>
		</html>
	);
}
