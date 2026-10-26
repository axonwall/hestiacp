import Link from "next/link";
import { APP_SETUP_PORTS } from "@hestiacp/lib";
import { effectiveUser, hestia, requireSession } from "@/lib/panel";
import { WEBAPP_CATALOG } from "@/lib/webapps";

/**
 * Quick Install App catalog (the cards of web/templates/pages/
 * list_webapps.php): every installer class in the PHP tree, extracted
 * to data/webapps.json. Apps whose setupApplication has been ported
 * can be installed; the rest carry their port status, never a fake
 * install button.
 */
export default async function WebAppsPage({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string }>;
}) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const { domain } = await searchParams;
	if (!domain) {
		const domains = await hestia.listWebDomains(user).catch(() => ({}));
		return (
			<div className="card">
				<h1>Quick Install App</h1>
				<p>Choose a web domain first:</p>
				<ul>
					{Object.keys(domains).map((d) => (
						<li key={d}>
							<Link href={`/list/webapps?domain=${encodeURIComponent(d)}`}>{d}</Link>
						</li>
					))}
				</ul>
			</div>
		);
	}
	return (
		<div className="card">
			<h1>Quick Install App — {domain}</h1>
			<div className="cards">
				{WEBAPP_CATALOG.map((app) => {
					const ported = Boolean(APP_SETUP_PORTS[app.name]);
					return (
						<div key={app.name} className="card">
							<p className="card-title">{app.name}</p>
							<p>
								Version: {app.version}
								{app.group ? ` · ${app.group}` : ""}
							</p>
							{ported ? (
								<Link
									href={`/add/webapp?app=${encodeURIComponent(app.name)}&domain=${encodeURIComponent(domain)}`}
								>
									Setup
								</Link>
							) : (
								<span>Installer port pending</span>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}
