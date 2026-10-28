import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";

/**
 * Domain logs (PHP web/list/web-log/ + list_weblog.php): the raw
 * access or error log lines in a <pre>. The toolbar mirrors the
 * template's top-bar menu: Back, View Logs (access), Download,
 * Error Log. The type defaults to access, as in PHP.
 */
export default async function WebLogPage({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; type?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const token = String(session.data.token ?? "");
	const { domain, type } = await searchParams;
	if (!domain) {
		return (
			<div className="card">
				<h1>{t("View Logs")}</h1>
				<p>
					<a href="/list/web">{t("Back")}</a> — pick a domain first.
				</p>
			</div>
		);
	}
	const logType = type === "error" ? "error" : "access";
	let lines: string;
	try {
		lines = await hestia.listWebDomainLog(user, domain, logType);
	} catch (error) {
		return (
			<div className="card">
				<h1>{t("View Logs")}</h1>
				<p className="error">{error instanceof Error ? error.message : String(error)}</p>
				<p>
					<Link href="/list/web">{t("Back")}</Link>
				</p>
			</div>
		);
	}
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<div className="toolbar-buttons">
						<Link className="button button-secondary" href="/list/web">
							<i className="fas fa-arrow-left icon-blue"></i>
							{t("Back")}
						</Link>
						<Link
							className="button button-secondary"
							href={`/list/web-log?domain=${encodeURIComponent(domain)}&type=access`}
						>
							<i className="fas fa-eye"></i>
							{t("View Logs")}
						</Link>
						<Link
							className="button button-secondary"
							href={`/download/web-log?domain=${encodeURIComponent(domain)}&type=${logType}&token=${encodeURIComponent(token)}`}
						>
							<i className="fas fa-download"></i>
							{t("Download")}
						</Link>
						<Link
							className="button button-secondary"
							href={`/list/web-log?domain=${encodeURIComponent(domain)}&type=error`}
						>
							<i className="fas fa-circle-exclamation"></i>
							{t("Error Log")}
						</Link>
					</div>
				</div>
			</div>
			<div className="container">
				<pre>{lines}</pre>
			</div>
		</div>
	);
}
