import Link from "next/link";
import { notFound } from "next/navigation";
import { WEBAPP_DEFINITIONS } from "@hestiacp/lib";
import { effectiveUser, hestia, requireSession } from "@/lib/panel";
import { catalogEntry } from "@/lib/webapps";
import { installWebAppAction } from "./actions";

/**
 * The setup wizard for one app on one domain (web/add/webapp): the
 * app's form schema from the catalog, the wizard's standard fields
 * (install directory, PHP version, database block), submitted to a
 * background install job.
 */
export default async function AddWebAppPage({
	searchParams,
}: {
	searchParams: Promise<{ app?: string; domain?: string }>;
}) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const { app = "", domain = "" } = await searchParams;
	const entry = catalogEntry(app);
	const def = WEBAPP_DEFINITIONS[app];
	if (!entry || !domain) notFound();
	if (!def) {
		return (
			<div className="card">
				<h1>{app}</h1>
				<p>
					This installer has not been ported yet — its setupApplication
					still exists only in the PHP tree. Ported so far:{" "}
					{Object.keys(WEBAPP_DEFINITIONS).join(", ")}.
				</p>
				<p>
					<Link href={`/list/webapps?domain=${encodeURIComponent(domain)}`}>
						← Catalog
					</Link>
				</p>
			</div>
		);
	}
	const installedPhp = await hestia
		.json<string[]>("v-list-sys-php", "json")
		.catch(() => [] as string[]);
	const phpChoices = def.phpSupported
		? installedPhp.filter((v) => def.phpSupported?.includes(v))
		: installedPhp;
	const slug = app.toLowerCase().replace(/[^a-z0-9]+/g, "");
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				Install {app} on {domain}
			</h1>
			<form action={installWebAppAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="app" value={app} />
				<input type="hidden" name="domain" value={domain} />
				{entry.form.map((field) =>
					field.type === "select" ? (
						<div key={field.key}>
							<label htmlFor={`f-${field.key}`}>{field.key}</label>
							<select className="form-select" id={`f-${field.key}`} name={field.key} defaultValue={field.value ?? ""}>
								{(field.options ?? []).map((o) => (
									<option key={o.value} value={o.value}>
										{o.label}
									</option>
								))}
							</select>
						</div>
					) : (
						<div key={field.key}>
							<label htmlFor={`f-${field.key}`}>{field.key}</label>
							<input className="form-control"
								id={`f-${field.key}`}
								name={field.key}
								type={field.type === "password" ? "password" : "text"}
								defaultValue={field.value ?? ""}
								autoComplete={field.type === "password" ? "new-password" : undefined}
							/>
						</div>
					),
				)}
				<div>
					<label htmlFor="f-dir">Install directory (blank = domain root)</label>
					<input className="form-control" id="f-dir" name="install_directory" />
				</div>
				<div>
					<label htmlFor="f-php">PHP version</label>
					<select className="form-select" id="f-php" name="php_version" defaultValue={phpChoices[phpChoices.length - 1] ?? ""}>
						{phpChoices.map((v) => (
							<option key={v} value={v}>
								{v}
							</option>
						))}
					</select>
				</div>
				{def.database ? (
					<fieldset>
						<legend>Database</legend>
						<label>
							<input type="checkbox" name="database_create" value="yes" defaultChecked />{" "}
							Create a database for the app
						</label>
						<div>
							<label htmlFor="f-dbname">Database name (suffix)</label>
							<input className="form-control" id="f-dbname" name="database_name" defaultValue={slug} />
						</div>
						<div>
							<label htmlFor="f-dbuser">Database user (suffix)</label>
							<input className="form-control" id="f-dbuser" name="database_user" defaultValue={slug} />
						</div>
						<div>
							<label htmlFor="f-dbpass">Database password</label>
							<input className="form-control" id="f-dbpass" name="database_secret" type="password" autoComplete="new-password" />
						</div>
						<div>
							<label htmlFor="f-dbhost">Database host</label>
							<input className="form-control" id="f-dbhost" name="database_host" defaultValue="localhost" />
						</div>
					</fieldset>
				) : null}
				<p>
					The install runs as a background job for {user}; progress shows
					on the jobs page.
				</p>
				<button type="submit" className="button">
					Install
				</button>{" "}
				<Link href={`/list/webapps?domain=${encodeURIComponent(domain)}`}>Cancel</Link>
			</form>
		</div>
	);
}
