"use client";

import { usePathname } from "next/navigation";

export interface MainMenuItem {
	href: string;
	/** Path prefixes that mark this item active. */
	match: string[];
	label: string;
	icon: string;
	stats: string[];
	title: string;
}

/**
 * The Hestia main menu (panel.php's .main-menu): big tab items with a
 * label, a FontAwesome icon, and used/limit stat lines. Rendered by
 * the root layout as a client island only so the active tab can track
 * the route — all data is computed on the server.
 */
export function MainMenu({ items }: { items: MainMenuItem[] }) {
	const pathname = usePathname() ?? "";
	return (
		<nav className="main-menu">
			<div className="container">
				<ul className="main-menu-list">
					{items.map((item) => {
						const active = item.match.some(
							(prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
						);
						return (
							<li className="main-menu-item" key={item.href}>
								<a
									className={`main-menu-item-link${active ? " active" : ""}`}
									href={item.href}
									title={item.title}
								>
									<p className="main-menu-item-label">
										{item.label}
										<i className={`fas ${item.icon}`}></i>
									</p>
									<ul className="main-menu-stats">
										{item.stats.map((line) => (
											<li key={line}>{line}</li>
										))}
									</ul>
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		</nav>
	);
}
