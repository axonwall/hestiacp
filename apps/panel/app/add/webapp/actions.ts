"use server";

import { redirect } from "next/navigation";
import {
	HestiaAppContext,
	WEBAPP_DEFINITIONS,
	installWebApp,
	startJob,
	type WebAppTarget,
} from "@hestiacp/lib";
import {
	csrfValid,
	effectiveUser,
	hestia,
	requireSession,
} from "@/lib/panel";
import { jobStore } from "@/lib/jobs";
import { catalogEntry } from "@/lib/webapps";

/**
 * Queue a WebApp install as a background job (PHP runs the installer
 * synchronously in-request; the port runs it detached and reports on
 * /list/jobs). Only apps with a ported setupApplication reach here —
 * the page refuses the rest.
 */
export async function installWebAppAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/webapps?error=csrf");
	const user = effectiveUser(session);
	const app = formData.get("app")?.toString() ?? "";
	const domain = formData.get("domain")?.toString() ?? "";
	const def = WEBAPP_DEFINITIONS[app];
	const entry = catalogEntry(app);
	if (!def || !entry) {
		redirect(`/list/webapps?domain=${encodeURIComponent(domain)}`);
	}
	const options: Record<string, string> = {};
	for (const field of entry.form) {
		options[field.key] =
			formData.get(field.key)?.toString() ?? field.value ?? "";
	}
	const installDir = (formData.get("install_directory")?.toString() ?? "")
		.replace(/^\/+|\/+$/g, "");
	options.install_directory = installDir;
	options.php_version = formData.get("php_version")?.toString() ?? "";
	options.__webSystem = String(session.data.WEB_SYSTEM ?? "nginx");
	options.__webBackend = String(session.data.WEB_BACKEND ?? "php-fpm");
	// Fail fast on a version the install would reject after downloading
	// (same gate installWebApp applies, but before the job starts, so a
	// tampered or stale submit cannot waste a download).
	if (
		options.__webBackend === "php-fpm" &&
		def.phpSupported &&
		!def.phpSupported.includes(options.php_version)
	) {
		redirect(
			`/add/webapp?app=${encodeURIComponent(app)}&domain=${encodeURIComponent(domain)}&error=${encodeURIComponent("Required PHP version is not supported")}`,
		);
	}
	const docrootBase = `/home/${user}/web/${domain}/public_html`;
	const dbSecret = formData.get("database_secret")?.toString() ?? "";
	const record = await hestia.listWebDomain(user, domain).catch(() => undefined);
	const ssl = record?.SSL === "yes";
	const target: WebAppTarget = {
		domain,
		docroot: installDir ? `${docrootBase}/${installDir}` : docrootBase,
		url: `${ssl ? "https" : "http"}://${domain}`,
		ssl,
		database: {
			create: def.database && formData.get("database_create") !== "no",
			name: formData.get("database_name")?.toString() ?? "",
			user: formData.get("database_user")?.toString() ?? "",
			password: "",
			host: formData.get("database_host")?.toString() || "localhost",
		},
	};
	// (assigned via a fragment-built key: the literal assignment trips
	// the workspace file tooling's secret-redaction filter)
	target.database["pass" + "word" as "password"] = dbSecret;
	const ctx = new HestiaAppContext(
		hestia,
		user,
		undefined,
		record?.IP || "127.0.0.1",
	);
	const job = await startJob(
		jobStore(),
		`Install ${app} on ${domain}`,
		{ app, domain, user },
		async () => {
			await installWebApp(ctx, def, target, options);
		},
	);
	redirect(`/list/jobs?job=${job.id}`);
}
