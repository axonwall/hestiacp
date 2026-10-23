import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession } from "@/lib/panel";
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
							Users
						</a>
					) : null}
					{isAdmin ? (
						<a className="top-link" href="/packages">
							Packages
						</a>
					) : null}
					{showFileManager ? (
						<a className="top-link" href="/fm/">
							File manager
						</a>
					) : null}
					{showTerminal ? (
						<a className="top-link" href="/list/terminal/">
							Web terminal
						</a>
					) : null}
					<span className="spacer" />
					{session ? (
						<>
							<span className="who">{String(session.data.user ?? "")}</span>
							<form action="/logout" method="post">
								<button type="submit" className="link-button">
									Log out
								</button>
							</form>
						</>
					) : null}
				</header>
				<main className="content">{children}</main>
			</body>
		</html>
	);
}
