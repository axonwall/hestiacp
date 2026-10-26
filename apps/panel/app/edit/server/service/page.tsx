import Link from "next/link";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import { saveServiceConfigAction } from "../actions";

/**
 * Service config editor: one page for every web/edit/server/<service>
 * archetype. The config path is either a fixed well-known path or
 * resolved from v-list-sys-<service>-config (CONFIG.config_path),
 * contents are read with v-open-fs-config and saved through the lib's
 * staged v-change-sys-service-config call.
 */
const STATIC_PATHS: Record<string, string> = {
	apache2: "/etc/apache2/apache2.conf",
	httpd: "/etc/httpd/conf/httpd.conf",
	bind9: "/etc/bind/named.conf",
	named: "/etc/named.conf",
	cron: "/etc/crontab",
	crond: "/etc/crontab",
	exim: "/etc/exim/exim.conf",
	exim4: "/etc/exim4/exim4.conf.template",
	fail2ban: "/etc/fail2ban/jail.local",
	ssh: "/etc/ssh/sshd_config",
	hestiaweb: "/var/spool/cron/crontabs/hestiaweb",
};

async function resolvePath(service: string): Promise<string | null> {
	if (STATIC_PATHS[service]) return STATIC_PATHS[service];
	try {
		const data = await hestia.json<{ CONFIG?: { config_path?: string } }>(
			`v-list-sys-${service}-config`,
			"json",
		);
		return data.CONFIG?.config_path ?? null;
	} catch {
		return null;
	}
}

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ service?: string; error?: string; saved?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const service = query.service ?? "";
	const path = service ? await resolvePath(service) : null;
	const contents = path ? await hestia.openFsConfig(path).catch(() => null) : null;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Service config")} — {service}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p className="ok">Changes have been saved.</p> : null}
			{!service || !path ? (
				<p className="error">No editable config path is known for this service.</p>
			) : contents === null ? (
				<p className="error">Could not read {path}.</p>
			) : (
				<>
					<p>
						<code>{path}</code>
					</p>
					<form action={saveServiceConfigAction}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="service" value={service} />
						<textarea className="form-control" name="contents" rows={24} defaultValue={contents} />
						<label>
							<input type="checkbox" name="restart" value="yes" defaultChecked />{" "}
							{t("Restart the service after saving")}
						</label>
						<button type="submit" className="button">
							{t("Save")}
						</button>
					</form>
				</>
			)}
			<p>
				<Link href="/list/server">← {t("Services")}</Link>
			</p>
		</div>
	);
}
