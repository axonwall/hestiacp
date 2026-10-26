import type { Metadata } from "next";
import type { ReactNode } from "react";
import { getSession, getT, hestia, effectiveUser } from "@/lib/panel";
import { returnToAdminAction } from "@/app/session/actions";
import { MainMenu, type MainMenuItem } from "@/components/MainMenu";
import "./globals.css";

export const metadata: Metadata = {
	title: "HestiaCP (Next.js panel)",
	description: "HestiaNG — HestiaCP panel rebuilt on Next.js",
};

/** PHP's humanize_usage_size/measure: values are stored in MB. */
function humanize(mb: number): [string, string] {
	const units = ["MB", "GB", "TB", "PB"];
	let value = mb;
	let unit = 0;
	while (value >= 1024 && unit < units.length - 1) {
		value /= 1024;
		unit++;
	}
	const text = value >= 100 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
	return [text, units[unit]];
}

function quotaLine(
	t: (s: string, ...a: string[]) => string,
	label: string,
	used: string | undefined,
	limit: string | undefined,
): string {
	const u = used ?? "0";
	if (limit === undefined || limit === "unlimited") {
		return `${t(label)}: ${u} / ∞`;
	}
	const pct = Number(limit) > 0 ? Math.round((Number(u) / Number(limit)) * 100) : 0;
	return `${t(label)}: ${u} / ${limit} (${pct}%)`;
}

export default async function RootLayout({ children }: { children: ReactNode }) {
	const session = await getSession();
	const t = await getT();

	// Theme selection mirrors web/templates/includes/css.php: the
	// account's theme (userTheme) wins over the system THEME; the
	// default bundle is always loaded and a non-default theme layers
	// on top. Pre-login there is no session yet — fall back to the
	// system config, as the PHP login session does.
	let theme = "default";
	if (session) {
		theme = String(session.data.userTheme || session.data.THEME || "default");
	} else {
		const sys = await hestia.listSysConfig().catch(() => null);
		theme = String(sys?.config?.THEME || "default");
	}

	const head = (
		<>
			<link rel="stylesheet" href="/hestia/themes/default.min.css" />
			{theme !== "default" ? (
				<link rel="stylesheet" href={`/hestia/themes/${theme}.min.css`} />
			) : null}
			<link rel="icon" href="/images/logo.svg" type="image/svg+xml" />
			<link rel="alternate icon" href="/images/favicon.png" type="image/png" />
		</>
	);

	// Unauthenticated screens (login, 2FA) render bare, like the PHP
	// login template — no chrome, just the theme.
	if (!session?.data.user) {
		return (
			<html lang="en">
				<head>{head}</head>
				<body>{children}</body>
			</html>
		);
	}

	const data = session.data;
	const user = effectiveUser(session);
	const isAdmin = data.userContext === "admin";
	const looking = Boolean(data.look);
	const record = await hestia.listUser(user).catch(() => null);

	const showFileManager = data.FILE_MANAGER === "true";
	const showTerminal = data.WEB_TERMINAL === "true" && data.login_shell !== "nologin";

	const menuItems: MainMenuItem[] = [];
	if (isAdmin && !looking) {
		menuItems.push({
			href: "/users",
			match: ["/users", "/add/user", "/edit/user", "/packages"],
			label: t("USER"),
			icon: "fa-users",
			stats: record
				? [
						`${t("Users")}: ${record.U_USERS ?? "0"}`,
						`${t("Suspended")}: ${record.SUSPENDED_USERS ?? "0"}`,
					]
				: [],
			title: t("Users"),
		});
	}
	if (data.WEB_SYSTEM && record?.WEB_DOMAINS !== "0") {
		menuItems.push({
			href: "/list/web",
			match: ["/list/web", "/add/web", "/edit/web", "/add/webapp", "/list/webapps"],
			label: t("WEB"),
			icon: "fa-earth-americas",
			stats: record
				? [
						quotaLine(t, "Domains", record.U_WEB_DOMAINS, record.WEB_DOMAINS),
						quotaLine(t, "Aliases", record.U_WEB_ALIASES, record.WEB_ALIASES),
					]
				: [],
			title: t("Web"),
		});
	}
	if (data.DNS_SYSTEM && record?.DNS_DOMAINS !== "0") {
		menuItems.push({
			href: "/list/dns",
			match: ["/list/dns", "/add/dns", "/edit/dns"],
			label: t("DNS"),
			icon: "fa-book-atlas",
			stats: record
				? [
						quotaLine(t, "Zones", record.U_DNS_DOMAINS, record.DNS_DOMAINS),
						quotaLine(t, "Records", record.U_DNS_RECORDS, record.DNS_RECORDS),
					]
				: [],
			title: t("DNS"),
		});
	}
	if (data.MAIL_SYSTEM && record?.MAIL_DOMAINS !== "0") {
		menuItems.push({
			href: "/list/mail",
			match: ["/list/mail", "/add/mail", "/edit/mail"],
			label: t("MAIL"),
			icon: "fa-envelopes-bulk",
			stats: record
				? [
						quotaLine(t, "Domains", record.U_MAIL_DOMAINS, record.MAIL_DOMAINS),
						quotaLine(t, "Accounts", record.U_MAIL_ACCOUNTS, record.MAIL_ACCOUNTS),
					]
				: [],
			title: t("Mail"),
		});
	}
	if (data.DB_SYSTEM && record?.DATABASES !== "0") {
		menuItems.push({
			href: "/list/db",
			match: ["/list/db", "/add/db", "/edit/db"],
			label: t("DB"),
			icon: "fa-database",
			stats: record ? [quotaLine(t, "Databases", record.U_DATABASES, record.DATABASES)] : [],
			title: t("DB"),
		});
	}
	if (data.CRON_SYSTEM && record?.CRON_JOBS !== "0") {
		menuItems.push({
			href: "/list/cron",
			match: ["/list/cron", "/add/cron", "/edit/cron"],
			label: t("CRON"),
			icon: "fa-clock",
			stats: record ? [quotaLine(t, "Jobs", record.U_CRON_JOBS, record.CRON_JOBS)] : [],
			title: t("Cron Jobs"),
		});
	}
	if (record?.BACKUPS !== "0") {
		menuItems.push({
			href: "/list/backup",
			match: ["/list/backup"],
			label: t("BACKUP"),
			icon: "fa-file-zipper",
			stats: record ? [quotaLine(t, "Backups", record.U_BACKUPS, record.BACKUPS)] : [],
			title: t("Backups"),
		});
	}

	const [diskSize, diskUnit] = humanize(Number(record?.U_DISK ?? 0));
	const [diskQuotaSize, diskQuotaUnit] = humanize(Number(record?.DISK_QUOTA ?? 0));
	const [bwSize, bwUnit] = humanize(Number(record?.U_BANDWIDTH ?? 0));
	const [bwQuotaSize, bwQuotaUnit] = humanize(Number(record?.BANDWIDTH ?? 0));
	const userIcon = looking ? "fa-binoculars" : isAdmin ? "fa-user-tie" : "fa-user";

	return (
		<html lang={String(data.language ?? "en")}>
			<head>{head}</head>
			<body>
				<div className="app">
					<header className="app-header">
						<div className="top-bar">
							<div className="container top-bar-inner">
								<div className="top-bar-left">
									<a href="/" className="top-bar-logo" title="HestiaCP">
										<img src="/images/logo-header.svg" alt="HestiaCP" width="54" height="29" />
									</a>
									<div className="top-bar-usage">
										<div className="top-bar-usage-inner">
											<span className="top-bar-usage-item">
												<i className={`fas ${userIcon}`}></i>
												<span className="u-text-bold">{user}</span>
											</span>
											<span className="top-bar-usage-item">
												<i className="fas fa-hard-drive"></i>
												<span className="u-text-bold">{diskSize}</span> {diskUnit} /{" "}
												<span className="u-text-bold">
													{record?.DISK_QUOTA === "unlimited" ? "∞" : diskQuotaSize}
												</span>{" "}
												{record?.DISK_QUOTA === "unlimited" ? "" : diskQuotaUnit}
											</span>
											<span className="top-bar-usage-item">
												<i className="fas fa-right-left"></i>
												<span className="u-text-bold">{bwSize}</span> {bwUnit} /{" "}
												<span className="u-text-bold">
													{record?.BANDWIDTH === "unlimited" ? "∞" : bwQuotaSize}
												</span>{" "}
												{record?.BANDWIDTH === "unlimited" ? "" : bwQuotaUnit}
											</span>
										</div>
									</div>
								</div>
								<div className="top-bar-right">
									<form action="/search" method="get" className="top-bar-search">
										<input
											name="q"
											type="search"
											className="form-control"
											placeholder={t("Search")}
											aria-label={t("Search")}
										/>
									</form>
									<a
										className="top-bar-menu-link"
										href="/list/notifications"
										title={t("Notifications")}
									>
										<i className="fas fa-bell"></i>
										<span className="u-hidden">{t("Notifications")}</span>
									</a>
									<details className="top-bar-menu">
										<summary className="top-bar-menu-link" title={t("Open menu")}>
											<i className="fas fa-bars"></i>
											<span className="u-hidden">{t("Open menu")}</span>
										</summary>
										<div className="top-bar-menu-panel">
											<ul className="top-bar-menu-list">
												<li className="top-bar-menu-item">
													<a className="top-bar-menu-link" href={`/users/${user}`}>
														<i className="fas fa-circle-user"></i>
														<span className="top-bar-menu-link-label">
															{user}
															{record?.NAME ? ` (${record.NAME})` : ""}
														</span>
													</a>
												</li>
												{showFileManager ? (
													<li className="top-bar-menu-item">
														<a className="top-bar-menu-link" href="/fm/">
															<i className="fas fa-folder-open"></i>
															<span className="top-bar-menu-link-label">{t("File Manager")}</span>
														</a>
													</li>
												) : null}
												{showTerminal ? (
													<li className="top-bar-menu-item">
														<a className="top-bar-menu-link" href="/list/terminal/">
															<i className="fas fa-terminal"></i>
															<span className="top-bar-menu-link-label">{t("Web Terminal")}</span>
														</a>
													</li>
												) : null}
												{isAdmin ? (
													<li className="top-bar-menu-item">
														<a className="top-bar-menu-link" href="/edit/server">
															<i className="fas fa-gears"></i>
															<span className="top-bar-menu-link-label">
																{t("Server settings")}
															</span>
														</a>
													</li>
												) : null}
												<li className="top-bar-menu-item">
													<a className="top-bar-menu-link" href="/list/jobs">
														<i className="fas fa-list-check"></i>
														<span className="top-bar-menu-link-label">Jobs</span>
													</a>
												</li>
												<li className="top-bar-menu-item">
													<a className="top-bar-menu-link" href="/list/stats">
														<i className="fas fa-chart-line"></i>
														<span className="top-bar-menu-link-label">{t("Statistics")}</span>
													</a>
												</li>
												<li className="top-bar-menu-item">
													<a
														className="top-bar-menu-link"
														href="https://hestiacp.com/docs/"
														target="_blank"
														rel="noopener"
													>
														<i className="fas fa-circle-question"></i>
														<span className="top-bar-menu-link-label">{t("Help")}</span>
													</a>
												</li>
												<li className="top-bar-menu-item">
													<form action="/logout" method="post" className="top-bar-logout-form">
														<button
															type="submit"
															className="top-bar-menu-link top-bar-menu-link-logout"
														>
															<i className="fas fa-right-from-bracket"></i>
															<span className="top-bar-menu-link-label">{t("Log out")}</span>
														</button>
													</form>
												</li>
											</ul>
										</div>
									</details>
								</div>
							</div>
						</div>
						<MainMenu items={menuItems} />
					</header>
					{looking ? (
						<div className="impersonation-banner">
							<span>{t("Viewing as %s", user)}</span>
							<form action={returnToAdminAction}>
								<input type="hidden" name="token" value={String(data.token ?? "")} />
								<button type="submit" className="link-button">
									{t("Return to admin")}
								</button>
							</form>
						</div>
					) : null}
					<main className="app-content">{children}</main>
					<footer className="app-footer">
						<div className="container">
							<p>
								<a
									href="https://hestiacp.com/"
									className="app-footer-link"
									target="_blank"
									rel="noopener"
								>
									Hestia Control Panel
								</a>{" "}
								v{String(data.VERSION ?? "")} · Next.js panel (HestiaNG)
							</p>
						</div>
					</footer>
				</div>
			</body>
		</html>
	);
}
