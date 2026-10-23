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
	return (
		<html lang="en">
			<body>
				<header className="topbar">
					<span className="brand">HestiaCP</span>
					<span className="codename">Next.js panel · HestiaNG spike</span>
					<span className="spacer" />
					{session ? (
						<>
							<span className="who">{session.user}</span>
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
