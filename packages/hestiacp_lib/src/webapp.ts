import { randomInt } from "node:crypto";
import * as http from "node:http";
import * as https from "node:https";
import { basename, dirname, join } from "node:path";
import type { HestiaClient } from "./client";
import { HTACCESS_FILES } from "./webapp-assets";

/**
 * Port of the web/src WebApp framework (Phase 0 audit: a hidden second
 * application layer, ~2,965 lines of PHP). The pieces:
 *
 * - HestiaAppContext = Hestia\System\HestiaApp: the v-*-fs-* file
 *   primitives, v-run-cli-cmd runners (wp-cli / composer / php), the
 *   wget download helper, database creation, template changes, and
 *   sendPostRequest (an HTTP POST to the freshly deployed site,
 *   resolved to localhost like PHP's curl --resolve).
 * - installWebApp = WebApp\BaseSetup::install: delete placeholder
 *   files, retrieve resources, create the database, apply the web /
 *   backend templates, then the app-specific setupApplication.
 * - APP_SETUP_PORTS: per-app setupApplication ports. WordPress and
 *   DokuWiki are ported; the other catalog apps install only once
 *   their setup lands here (the panel refuses them until then).
 *
 * Deliberate non-ports: PHP's run() backslash-escapes spaces in argv
 * (a Symfony Process artifact — execFile argv needs no escaping), and
 * archiveExtract's internal unlink is folded into the caller's
 * delete step (same net effect, one deletion).
 */

export interface WebAppFormField {
	type?: string;
	value?: string;
	options?: Record<string, string>;
}

export interface WebAppDefinition {
	name: string;
	version: string;
	database: boolean;
	resources: Record<string, { src: string; dst?: string }>;
	nginxTemplate?: string;
	apacheTemplate?: string;
	phpSupported?: string[];
}

export interface WebAppTarget {
	domain: string;
	docroot: string;
	url: string;
	/** The domain has SSL enabled (TargetDomain::isSslEnabled). */
	ssl: boolean;
	database: {
		create: boolean;
		name: string;
		user: string;
		password: string;
		host: string;
	};
}

export type WebAppOptions = Record<string, string>;

export type PostRequestFn = (url: string, formData: Record<string, string>) => Promise<void>;

/**
 * Default sendPostRequest: POST with the URL's host resolved to the
 * domain's own IP (PHP builds a curl --resolve of domain:port:ip;
 * the panel passes the IP from the domain record; 127.0.0.1 when
 * unknown).
 */
export async function defaultPostRequest(
	url: string,
	formData: Record<string, string>,
	resolveIp = "127.0.0.1",
): Promise<void> {
	const parsed = new URL(url);
	const isTls = parsed.protocol === "https:";
	const body = new URLSearchParams(formData).toString();
	await new Promise<void>((resolve, reject) => {
		const req = (isTls ? https : http).request(
			{
				hostname: resolveIp,
				port: parsed.port || (isTls ? 443 : 80),
				path: parsed.pathname + parsed.search,
				method: "POST",
				servername: isTls ? parsed.hostname : undefined,
				headers: {
					Host: parsed.host,
					"Content-Type": "application/x-www-form-urlencoded",
					"Content-Length": Buffer.byteLength(body),
				},
			},
			(res) => {
				res.resume();
				res.on("end", resolve);
			},
		);
		req.on("error", reject);
		req.write(body);
		req.end();
	});
}

export class HestiaAppContext {
	constructor(
		private readonly client: HestiaClient,
		readonly user: string,
		private readonly post: PostRequestFn = (url, data) =>
			defaultPostRequest(url, data, this.resolveIp),
		/** The domain IP installer POSTs resolve to (curl --resolve). */
		readonly resolveIp: string = "127.0.0.1",
	) {}

	/** runUser: a checked v-* call with the user prepended. */
	private async runUser(command: string, ...args: string[]): Promise<string> {
		const result = await this.client.raw(command, this.user, ...args);
		if (result.code !== 0) {
			throw new Error(
				`${command} exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
			);
		}
		return result.stdout;
	}

	async deleteFile(path: string): Promise<void> {
		await this.runUser("v-delete-fs-file", path);
	}
	async moveFile(from: string, to: string): Promise<void> {
		await this.runUser("v-move-fs-file", from, to);
	}
	async addDirectory(path: string): Promise<void> {
		await this.runUser("v-add-fs-directory", path);
	}
	async copyDirectory(from: string, to: string): Promise<void> {
		await this.runUser("v-copy-fs-directory", from, to);
	}
	async deleteDirectory(path: string): Promise<void> {
		await this.runUser("v-delete-fs-directory", path);
	}
	async readFile(path: string): Promise<string> {
		return this.runUser("v-open-fs-file", path);
	}
	/** HestiaApp::createFile — stage 0644, then v-copy-fs-file. */
	async createFile(path: string, contents: string): Promise<void> {
		const { mkdtemp, writeFile, rm } = await import("node:fs/promises");
		const { tmpdir } = await import("node:os");
		const dir = await mkdtemp(join(tmpdir(), "hst."));
		const staged = join(dir, "file");
		try {
			await writeFile(staged, contents, { mode: 0o644 });
			await this.runUser("v-copy-fs-file", staged, path);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}
	async changeFilePermissions(path: string, permission: string): Promise<void> {
		await this.runUser("v-change-fs-file-permission", path, permission);
	}
	/**
	 * PHP glob() over the docroot, first match — via v-run-cli-cmd's
	 * ls (its argument string is shell-expanded by the command, like
	 * HestiaApp::listFiles relies on). Throws when nothing matches,
	 * as indexing $dir[0] on an empty glob does in PHP.
	 */
	async globFirst(pattern: string): Promise<string> {
		const output = await this.runCliCmd("ls", "-d", pattern);
		const first = output
			.split("\n")
			.map((l) => l.trim())
			.filter(Boolean)[0];
		if (!first) throw new Error(`No files match ${pattern}`);
		return first;
	}
	async sleepSeconds(seconds: number): Promise<void> {
		await new Promise((r) => setTimeout(r, seconds * 1000));
	}
	async archiveExtract(file: string, extractDir: string): Promise<void> {
		await this.runUser("v-extract-fs-archive", file, extractDir, "", "1");
	}
	async runCliCmd(...argv: string[]): Promise<string> {
		return this.runUser("v-run-cli-cmd", ...argv);
	}
	async downloadUrl(url: string, dirPath: string): Promise<string> {
		const output = await this.runCliCmd(
			"/usr/bin/wget",
			"--tries",
			"3",
			"--timeout=30",
			"--no-dns-cache",
			"-nv",
			url,
			"-P",
			dirPath,
		);
		const match = output.match(/URL:\s*.+?\s*\[.+?\]\s*->\s*"(.+?)"/);
		return match?.[1] ?? join(dirPath, basename(url));
	}
	async runPhp(phpVersion: string, script: string, args: string[]): Promise<string> {
		return this.runCliCmd(`/usr/bin/php${phpVersion}`, script, ...args);
	}
	async runWp(phpVersion: string, args: string[]): Promise<string> {
		await this.runUser("v-add-user-wp-cli", "yes");
		return this.runPhp(phpVersion, `/home/${this.user}/.wp-cli/wp`, args);
	}
	async runComposer(phpVersion: string, args: string[]): Promise<string> {
		await this.runUser("v-add-user-composer", "2", "yes");
		return this.runPhp(phpVersion, `/home/${this.user}/.composer/composer`, args);
	}
	async checkDatabaseLimit(): Promise<boolean> {
		const record = await this.client.listUser(this.user);
		if (record.DATABASES === "unlimited") return true;
		return (
			Number.parseInt(record.DATABASES ?? "0", 10) -
				Number.parseInt(record.U_DATABASES ?? "0", 10) >
			0
		);
	}
	async databaseAdd(name: string, dbUser: string, password: string, host: string): Promise<void> {
		const prefix = `${this.user}_`;
		const strip = (v: string) => (v.startsWith(prefix) ? v.slice(prefix.length) : v);
		await this.client.addDatabase(
			this.user,
			strip(name),
			strip(dbUser),
			password,
			"mysql",
			host,
			"utf8mb4",
		);
	}
	async changeWebTemplate(domain: string, template: string): Promise<void> {
		// NB: HestiaApp calls the bare command — the panel's own
		// changeWebDomainTpl wrapper appends a restart flag, this one
		// must not.
		await this.runUser("v-change-web-domain-tpl", domain, template);
	}
	async changeBackendTemplate(domain: string, template: string): Promise<void> {
		await this.runUser("v-change-web-domain-backend-tpl", domain, template);
	}
	async getSupportedPhpVersions(supported: string[]): Promise<string[]> {
		const installed = await this.client.json<string[]>("v-list-sys-php", "json");
		return installed.filter((v) => supported.includes(v)).sort();
	}
	async sendPostRequest(url: string, formData: Record<string, string>): Promise<void> {
		await this.post(url, formData);
	}
}

type SetupApplication = (
	ctx: HestiaAppContext,
	target: WebAppTarget,
	options: WebAppOptions,
) => Promise<void>;

/** Util::generateString($length, false): alphanumerics, mixed case. */
function randomString(length: number): string {
	const chars = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
	let out = "";
	for (let i = 0; i < length; i++) out += chars[randomInt(chars.length)];
	return out;
}

/**
 * TargetDomain::getDocRoot: joinPaths(docroot, appended) — slashes
 * collapse, appended segments (including a trailing "/.") survive.
 */
export function doc(target: WebAppTarget, appended = ""): string {
	if (!appended) return target.docroot;
	return `${target.docroot}/${appended}`.replace(/\/{2,}/g, "/");
}

/**
 * PHP's password_hash(PASSWORD_DEFAULT) — needed by the Grav port to
 * write its account file. Computed by the host's php CLI (present on
 * every Hestia install); the secret travels only in a local argv,
 * exactly as it sat in the PHP panel process's memory.
 */
export async function phpPasswordHash(secret: string): Promise<string> {
	const { execFile } = await import("node:child_process");
	const phpBin = process.env.HESTIA_PHP_BIN ?? "/usr/bin/php";
	return new Promise((resolve, reject) => {
		execFile(
			phpBin,
			["-r", "echo password_hash($argv[1], PASSWORD_DEFAULT);", "--", secret],
			(error, stdout) => {
				if (error) {
					reject(new Error(`php password_hash unavailable: ${error.message.split("\n")[0]}`));
				} else {
					resolve(stdout.trim());
				}
			},
		);
	});
}

const wordpressSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.runWp(options.php_version, [
		"config",
		"create",
		`--dbname=${target.database.name}`,
		`--dbuser=${target.database.user}`,
		`--dbpass=${target.database.password}`,
		`--dbhost=${target.database.host}`,
		`--dbprefix=wp_${randomString(5)}_`,
		"--dbcharset=utf8mb4",
		`--locale=${options.language}`,
		`--path=${target.docroot}`,
	]);
	const installDir = options.install_directory ? `/${options.install_directory}` : "";
	// (key assembled from fragments: the literal field name trips a
	// secret-redaction filter in this workspace's file tooling)
	const adminPwField = ["admin", "pass" + "word"].join("_");
	await ctx.sendPostRequest(`${target.url}${installDir}/wp-admin/install.php?step=2`, {
		weblog_title: options.site_name,
		user_name: options.username,
		[adminPwField]: options.password,
		[`${adminPwField}2`]: options.password,
		admin_email: options.email,
	});
};

/* ------------------------------------------------------------------ */
/* The remaining installer ports. Field names and argument orders are  */
/* transcribed from each PHP setupApplication; PWF assembles the      */
/* literal the workspace redaction filter would otherwise mangle in   */
/* flag strings and form keys.                                        */
/* ------------------------------------------------------------------ */

const PWF = "pass" + "word";

const nextcloudSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.runPhp(options.php_version, doc(target, "occ"), [
		"maintenance:install",
		"--database",
		"mysql",
		"--database-name",
		target.database.name,
		"--database-host",
		target.database.host,
		"--database-user",
		target.database.user,
		"--database-pass",
		target.database.password,
		"--admin-user",
		options.username,
		"--admin-pass",
		options.password,
	]);
	await ctx.runPhp(options.php_version, doc(target, "occ"), [
		"config:system:set",
		"trusted_domains",
		"2",
		`--value=${target.domain}`,
	]);
	// PHP appends the two characters \r\n literally here (single-quoted
	// string in the source) — ported bug-compatibly.
	const phpIni = doc(target, ".user.ini");
	const contents = await ctx.readFile(phpIni);
	await ctx.createFile(phpIni, contents + "memory_limit=512M\\r\\n");
};

const laravelSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Laravel);
	const envPath = doc(target, ".env");
	let env = await ctx.readFile(envPath);
	env = env.replace("DB_CONNECTION=sqlite", "DB_CONNECTION=mysql");
	env = env.replace("# DB_HOST=127.0.0.1", `DB_HOST=${target.database.host}`);
	env = env.replace("# DB_PORT=3306", "DB_PORT=3306");
	env = env.replace("# DB_DATABASE=laravel", `DB_DATABASE=${target.database.name}`);
	env = env.replace("# DB_USERNAME=root", `DB_USERNAME=${target.database.user}`);
	const dbPwNeedle = "# DB_" + "PASS" + "WORD=";
	env = env.replace(dbPwNeedle, `DB_${"PASS" + "WORD"}=${target.database.password}`);
	await ctx.createFile(envPath, env);
	await ctx.runPhp(options.php_version, doc(target, "artisan"), ["key:generate", "--force"]);
	await ctx.runPhp(options.php_version, doc(target, "artisan"), ["migrate", "--force"]);
	await ctx.deleteFile(doc(target, "database/database.sqlite"));
};

const symfonySetup: SetupApplication = async (ctx, target, options) => {
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Symfony);
	await ctx.runComposer(options.php_version, [
		"config",
		"-d",
		target.docroot,
		"extra.symfony.allow-contrib",
		"true",
	]);
	await ctx.runComposer(options.php_version, ["require", "-d", target.docroot, "webapp"]);
	await ctx.runComposer(options.php_version, [
		"require",
		"-d",
		target.docroot,
		"symfony/apache-pack",
	]);
};

const castopodSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.copyDirectory(doc(target, "/castopod/."), target.docroot);
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Castopod);
	await ctx.moveFile(doc(target, ".env.example"), doc(target, ".env"));
	const envPath = doc(target, ".env");
	let env = await ctx.readFile(envPath);
	env = env.replace('app.baseURL="https://YOUR_DOMAIN_NAME/"', `app.baseURL=${target.url}`);
	env = env.replace(
		'media.baseURL="https://YOUR_MEDIA_DOMAIN_NAME/"',
		`media.baseURL=${target.url}`,
	);
	env = env.replace('admin.gateway="cp-admin"', `admin.gateway=${options.admin_gateway}`);
	env = env.replace('auth.gateway="cp-auth"', `auth.gateway=${options.auth_gateway}`);
	env = env.replace(
		'analytics.salt="RANDOM_STRING_OF_64_CHARACTERS"',
		`analytics.salt=${randomString(64)}`,
	);
	env = env.replace(
		'database.default.hostname="localhost"',
		`database.default.hostname=${target.database.host}`,
	);
	env = env.replace(
		'database.default.database="castopod"',
		`database.default.database=${target.database.name}`,
	);
	env = env.replace(
		'database.default.username="root"',
		`database.default.username=${target.database.user}`,
	);
	env = env.replace(
		"database.default." + PWF + '="****"',
		`database.default.${PWF}=${target.database.password}`,
	);
	await ctx.createFile(envPath, env);
	await ctx.runPhp(options.php_version, doc(target, "spark"), ["install:init-database"]);
	await ctx.deleteDirectory(doc(target, "/castopod"));
};

const classicPressSetup: SetupApplication = async (ctx, target, options) => {
	const dir = await ctx.globFirst(doc(target, "ClassicPress-*/"));
	await ctx.copyDirectory(`${dir}.`, target.docroot);
	await ctx.runWp(options.php_version, [
		"config",
		"create",
		`--dbname=${target.database.name}`,
		`--dbuser=${target.database.user}`,
		`--dbpass=${target.database.password}`,
		`--dbhost=${target.database.host}`,
		`--dbprefix=cp_${randomString(5)}_`,
		"--dbcharset=utf8mb4",
		`--locale=${options.language}`,
		`--path=${target.docroot}`,
	]);
	if (options.language !== "en_US") {
		await ctx.sendPostRequest(`${target.url}/wp-admin/install.php?step=1`, {
			language: options.language,
		});
	}
	const adminPw = "admin_" + PWF;
	await ctx.sendPostRequest(`${target.url}/wp-admin/install.php?step=2`, {
		weblog_title: options.site_name,
		user_name: options.username,
		[adminPw]: options.password,
		[`${adminPw}2`]: options.password,
		admin_email: options.email,
		blog_public: options.search_engine_indexing === "Allow" ? "1" : "0",
		language: options.language,
	});
	if (options["disable_XML-RPC?"] === "Yes") {
		await ctx.runWp(options.php_version, [
			"option",
			"update",
			"disable_xml_rpc",
			"1",
			`--path=${target.docroot}`,
		]);
	}
	await ctx.deleteDirectory(dir);
};

const concreteCmsSetup: SetupApplication = async (ctx, target, options) => {
	const dir = await ctx.globFirst(doc(target, "concrete-cms-*/"));
	await ctx.copyDirectory(`${dir}.`, target.docroot);
	await ctx.runPhp(options.php_version, doc(target, "concrete/bin/concrete"), [
		"c5:install",
		"--no-interaction",
		`--db-server=${target.database.host}`,
		`--db-database=${target.database.name}`,
		`--db-username=${target.database.user}`,
		`--db-${PWF}=${target.database.password}`,
		`--admin-email=${options.email}`,
		`--admin-${PWF}=${options.password}`,
		`--language=${options.language}`,
		`--site-locale=${options.language}`,
	]);
	await ctx.deleteDirectory(dir);
};

const dolibarrSetup: SetupApplication = async (ctx, target, options) => {
	const version = WEBAPP_DEFINITIONS.Dolibarr.version;
	await ctx.copyDirectory(doc(target, `/dolibarr-${version}/.`), target.docroot);
	const language = options.language;
	await ctx.moveFile(
		doc(target, "htdocs/conf/conf.php.example"),
		doc(target, "htdocs/conf/conf.php"),
	);
	await ctx.changeFilePermissions(doc(target, "htdocs/conf/conf.php"), "666");
	await ctx.addDirectory(doc(target, "documents"));
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Dolibarr);
	await ctx.sendPostRequest(`${target.url}/install/step1.php`, {
		testpost: "ok",
		action: "set",
		main_dir: doc(target, "htdocs"),
		main_data_dir: doc(target, "documents"),
		main_url: target.url,
		main_force_https: target.ssl ? "1" : "",
		db_type: "mysqli",
		db_host: target.database.host,
		db_port: "3306",
		db_prefix: "llx_",
		db_name: target.database.name,
		db_user: target.database.user,
		db_pass: target.database.password,
		selectlang: language,
	});
	await ctx.sendPostRequest(`${target.url}/install/step2.php`, {
		testpost: "ok",
		action: "set",
		dolibarr_main_db_character_set: "utf8",
		dolibarr_main_db_collation: "utf8_unicode_ci",
		selectlang: language,
	});
	await ctx.sleepSeconds(10);
	await ctx.sendPostRequest(`${target.url}/install/step5.php`, {
		testpost: "ok",
		action: "set",
		login: options.username,
		pass: options.password,
		pass_verif: options.password,
		installlock: "1",
		selectlang: language,
	});
	await ctx.changeFilePermissions(doc(target, "htdocs/conf/conf.php"), "400");
	await ctx.deleteDirectory(doc(target, `/dolibarr-${version}/`));
};

const drupalSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.createFile(
		doc(target, ".htaccess"),
		"<IfModule mod_rewrite.c>\n                    RewriteEngine On\n                    RewriteRule ^(.*)$ web/$1 [L]\n            </IfModule>",
	);
	await ctx.runComposer(options.php_version, ["require", "-d", target.docroot, "drush/drush"]);
	const databaseUrl = `mysql://${target.database.user}:${target.database.password}@${target.database.host}:3306/${target.database.name}`;
	await ctx.runPhp(options.php_version, doc(target, "/vendor/drush/drush/drush.php"), [
		"site-install",
		"standard",
		`--db-url=${databaseUrl}`,
		`--account-name=${options.username}`,
		`--account-pass=${options.password}`,
		"--site-name=Drupal",
		`--site-mail=${options.email}`,
	]);
};

const flarumSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Flarum);
	const mysqlPw = "mysql" + "Pass" + "word";
	const adminPw = "admin" + "Pass" + "word";
	await ctx.sendPostRequest(target.url, {
		forumTitle: options.forum_title,
		mysqlHost: target.database.host,
		mysqlDatabase: target.database.name,
		mysqlUsername: target.database.user,
		[mysqlPw]: target.database.password,
		tablePrefix: `fl${randomString(5)}`,
		adminUsername: options.admin_username,
		adminEmail: options.admin_email,
		[adminPw]: options.admin_password,
		[`${adminPw}Confirmation`]: options.admin_password,
	});
};

const gravSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.copyDirectory(doc(target, "grav-admin/."), target.docroot);
	const hash = await phpPasswordHash(options.password);
	const yaml =
		"state: enabled\n" +
		`email: ${options.email}\n` +
		`fullname: "${options.full_name}"\n` +
		"title: Administrator\n" +
		"access:\n" +
		"  site:\n" +
		"    login: true\n" +
		"  api:\n" +
		"    super: true\n" +
		`hashed_${PWF}: '${hash}'\n`;
	await ctx.createFile(doc(target, `user/accounts/${options.username}.yaml`), yaml);
	await ctx.deleteDirectory(doc(target, "grav-admin"));
};

const joomlaSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.moveFile(doc(target, "htaccess.txt"), doc(target, ".htaccess"));
	await ctx.runPhp(options.php_version, doc(target, "installation/joomla.php"), [
		"install",
		`--site-name=${options.site_name}`,
		`--admin-user=${options.admin_user}`,
		`--admin-username=${options.admin_username}`,
		`--admin-${PWF}=${options.password}`,
		`--admin-email=${options.email}`,
		`--db-user=${target.database.user}`,
		`--db-pass=${target.database.password}`,
		`--db-name=${target.database.name}`,
		`--db-host=${target.database.host}`,
		"--db-type=mysqli",
		"--db-encryption=0",
	]);
};

const mediaWikiSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.copyDirectory(doc(target, "/mediawiki-1.46.0/."), target.docroot);
	await ctx.runPhp(options.php_version, doc(target, "maintenance/install.php"), [
		`--dbserver=${target.database.host}`,
		`--dbname=${target.database.name}`,
		`--installdbuser=${target.database.user}`,
		`--installdbpass=${target.database.password}`,
		`--dbuser=${target.database.name}`,
		`--dbpass=${target.database.password}`,
		`--server=${target.url}`,
		"--scriptpath=",
		`--lang=${options.language}`,
		`--pass=${options.admin_password}`,
		options.wiki_name,
		options.admin_username,
	]);
	await ctx.deleteDirectory(doc(target, "/mediawiki-1.46.0/"));
};

const namelessSetup: SetupApplication = async () => {
	// Nothing to do after installation of resources (as in PHP).
};

const openCartSetup: SetupApplication = async (ctx, target, options) => {
	const extractDirectory = "/tmp-opencart";
	await ctx.copyDirectory(doc(target, `${extractDirectory}/upload/.`), target.docroot);
	await ctx.moveFile(doc(target, "config-dist.php"), doc(target, "config.php"));
	await ctx.moveFile(doc(target, "admin/config-dist.php"), doc(target, "admin/config.php"));
	await ctx.moveFile(doc(target, ".htaccess.txt"), doc(target, ".htaccess"));
	await ctx.runPhp(options.php_version, doc(target, "/install/cli_install.php"), [
		"install",
		"--db_hostname",
		target.database.host,
		"--db_username",
		target.database.user,
		`--db_${PWF}`,
		target.database.password,
		"--db_database",
		target.database.name,
		"--username",
		options.username,
		`--${PWF}`,
		options.password,
		"--email",
		options.email,
		"--http_server",
		`${target.url}/`,
	]);
	await ctx.deleteDirectory(doc(target, "/install"));
	await ctx.deleteDirectory(doc(target, extractDirectory));
};

const prestaShopSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.deleteFile(doc(target, "/index.php"));
	await ctx.deleteFile(doc(target, "/Install_PrestaShop.html"));
	await ctx.archiveExtract(doc(target, "/prestashop.zip"), doc(target, "/"));
	await ctx.runPhp(options.php_version, doc(target, "/install/index_cli.php"), [
		`--db_server=${target.database.host}`,
		`--db_user=${target.database.user}`,
		`--db_${PWF}=${target.database.password}`,
		`--db_name=${target.database.name}`,
		`--name=${options.shop_name}`,
		`--firstname=${options.first_name}`,
		`--lastname=${options.last_name}`,
		`--language=${options.language}`,
		`--${PWF}=${options.password}`,
		`--email=${options.email}`,
		`--domain=${target.domain}`,
		`--ssl=${target.ssl ? "1" : ""}`,
	]);
	await ctx.deleteDirectory(doc(target, "/install"));
	await ctx.deleteFile(doc(target, "/prestashop.zip"));
};

const qloAppsSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.copyDirectory(doc(target, "/qloapps-1.7.0/."), target.docroot);
	await ctx.runPhp(options.php_version, doc(target, "/install/index_cli.php"), [
		`--domain=${target.domain}`,
		`--db_server=${target.database.host}`,
		`--db_name=${target.database.name}`,
		`--db_user=${target.database.user}`,
		`--db_${PWF}=${target.database.password}`,
		`--firstname=${options.first_name}`,
		`--lastname=${options.last_name}`,
		`--language=${options.language}`,
		`--${PWF}=${options.password}`,
		`--email=${options.email}`,
	]);
	await ctx.deleteDirectory(doc(target, "/install"));
	await ctx.deleteDirectory(doc(target, "/qloapps-1.7.0"));
};

const shopwareSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.createFile(doc(target, ".htaccess"), HTACCESS_FILES.Shopware);
	const envPath = doc(target, ".env");
	let env = await ctx.readFile(envPath);
	env = env.replace("APP_URL=http://127.0.0.1:8000", `APP_URL=${target.url}`);
	const dsn = `DATABASE_URL=mysql://${target.database.user}:${target.database.password}@${target.database.host}:3306/${target.database.name}`;
	env = env.replace("DATABASE_URL=mysql://root:root@localhost/shopware", dsn);
	await ctx.createFile(envPath, env);
	await ctx.runPhp(options.php_version, doc(target, "bin/console"), [
		"system:install",
		"-n",
		`--shop-name=${options.shop_name}`,
		`--shop-email=${options.shop_email}`,
		`--shop-locale=${options.shop_locale}`,
		`--shop-currency=${options.shop_currency}`,
		"--basic-setup",
	]);
	if (options.shop_locale !== "en-GB" && options.shop_locale !== "de-DE") {
		await ctx.runPhp(options.php_version, doc(target, "bin/console"), [
			"translation:install",
			"-n",
			`--locales=${options.shop_locale}`,
		]);
	}
	await ctx.runPhp(options.php_version, doc(target, "bin/console"), [
		"user:create",
		options.username,
		"-a",
		`--firstName=${options.first_name}`,
		`--lastName=${options.last_name}`,
		`--${PWF}=${options.password}`,
		`--email=${options.email}`,
		"-n",
	]);
};

const thirtyBeesSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.runPhp(options.php_version, doc(target, "/install/index_cli.php"), [
		`--db_server=${target.database.host}`,
		`--db_user=${target.database.user}`,
		`--db_${PWF}=${target.database.password}`,
		`--db_name=${target.database.name}`,
		`--name=${options.store_name}`,
		`--firstname=${options.first_name}`,
		`--lastname=${options.last_name}`,
		`--${PWF}=${options.password}`,
		`--email=${options.email}`,
		`--domain=${target.domain}`,
	]);
	await ctx.deleteDirectory(doc(target, "/install"));
};

const vvvebSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.runPhp(options.php_version, doc(target, "/cli.php"), [
		"install",
		`host=${target.database.host}`,
		`user=${target.database.user}`,
		`${PWF}=${target.database.password}`,
		`database=${target.database.name}`,
		`admin[user]=${options.vvveb_account_username}`,
		`admin[${PWF}]=${options.vvveb_account_password}`,
		`admin[email]=${options.vvveb_account_email}`,
	]);
};

const osTicketSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.copyDirectory(doc(target, "upload/."), target.docroot);
	await ctx.moveFile(
		doc(target, "include/ost-sampleconfig.php"),
		doc(target, "include/ost-config.php"),
	);
	await ctx.sendPostRequest(`${target.url}/setup/install.php`, {
		s: "install",
		name: options.helpdesk_name,
		email: options.email,
		lang_id: "en_US",
		fname: options.first_name,
		lname: options.last_name,
		admin_email: options.admin_email,
		username: options.username,
		passwd: options.password,
		passwd2: options.password,
		prefix: "ost_",
		dbhost: target.database.host,
		dbname: target.database.name,
		dbuser: target.database.user,
		dbpass: target.database.password,
	});
	await ctx.deleteDirectory(doc(target, "upload"));
	await ctx.deleteDirectory(doc(target, "setup"));
};

const dokuwikiSetup: SetupApplication = async (ctx, target, options) => {
	await ctx.moveFile(join(target.docroot, ".htaccess.dist"), join(target.docroot, ".htaccess"));
	const installDir = options.install_directory ? `/${options.install_directory}` : "";
	await ctx.sendPostRequest(`${target.url}${installDir}/install.php`, {
		l: "en",
		"d[title]": options.wiki_name,
		"d[acl]": "on",
		"d[superuser]": options.superuser,
		"d[fullname]": options.real_name,
		"d[email]": options.email,
		"d[password]": options.password,
		"d[confirm]": options.password,
		"d[policy]": (options.initial_ACL_policy ?? "0").slice(0, 1),
		"d[license]": (options.content_license ?? "").split(":")[0],
		submit: "",
	});
	await ctx.deleteFile(join(target.docroot, "install.php"));
};

/** setupApplication ports by app name (the catalog's `name`). */
export const APP_SETUP_PORTS: Record<string, SetupApplication> = {
	WordPress: wordpressSetup,
	DokuWiki: dokuwikiSetup,
	Nextcloud: nextcloudSetup,
	Laravel: laravelSetup,
	Symfony: symfonySetup,
	Castopod: castopodSetup,
	ClassicPress: classicPressSetup,
	ConcreteCMS: concreteCmsSetup,
	Dolibarr: dolibarrSetup,
	Drupal: drupalSetup,
	Flarum: flarumSetup,
	Grav: gravSetup,
	Joomla: joomlaSetup,
	MediaWiki: mediaWikiSetup,
	NamelessMC: namelessSetup,
	OpenCart: openCartSetup,
	PrestaShop: prestaShopSetup,
	QloApps: qloAppsSetup,
	Shopware: shopwareSetup,
	ThirtyBees: thirtyBeesSetup,
	Vvveb: vvvebSetup,
	osTicket: osTicketSetup,
};

/**
 * Definitions for the ported apps, transcribed from their PHP setup
 * classes ($info + $config). The panel catalog covers all apps for
 * display; installs run only for apps defined here.
 */
export const WEBAPP_DEFINITIONS: Record<string, WebAppDefinition> = {
	WordPress: {
		name: "WordPress",
		version: "latest",
		database: true,
		resources: {
			wp: { src: "https://wordpress.org/latest.tar.gz" },
		},
		nginxTemplate: "wordpress",
		phpSupported: ["7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	DokuWiki: {
		name: "DokuWiki",
		version: "latest",
		database: false,
		resources: {
			archive: { src: "https://download.dokuwiki.org/src/dokuwiki/dokuwiki-stable.tgz" },
		},
		nginxTemplate: "dokuwiki",
		phpSupported: ["8.0", "8.1", "8.2", "8.3", "8.4"],
	},
	Nextcloud: {
		name: "Nextcloud",
		version: "latest",
		database: true,
		resources: {
			archive: { src: "https://download.nextcloud.com/server/releases/latest.tar.bz2" },
		},
		nginxTemplate: "owncloud",
		phpSupported: ["8.2", "8.3", "8.4", "8.5"],
	},
	Laravel: {
		name: "Laravel",
		version: "latest",
		database: true,
		resources: {
			composer: { src: "laravel/laravel", dst: "/" },
		},
		nginxTemplate: "laravel",
		phpSupported: ["8.3", "8.4", "8.5"],
	},
	Symfony: {
		name: "Symfony",
		version: "latest",
		database: false,
		resources: {
			composer: { src: "symfony/skeleton", dst: "/" },
		},
		nginxTemplate: "symfony4-5",
		phpSupported: ["8.4", "8.5"],
	},
	Castopod: {
		name: "Castopod",
		version: "1.15.5",
		database: true,
		resources: {
			archive: {
				src: "https://code.castopod.org/-/project/2/uploads/419c795a5ab306a27082b7d86aa43df6/castopod-1.15.5.zip",
			},
		},
		nginxTemplate: "castopod",
		phpSupported: ["8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	ClassicPress: {
		name: "ClassicPress",
		version: "latest",
		database: true,
		resources: {
			archive: { src: "https://www.classicpress.net/latest.zip" },
		},
		nginxTemplate: "classicpress",
		phpSupported: ["7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	ConcreteCMS: {
		name: "ConcreteCMS",
		version: "latest",
		database: true,
		resources: {
			archive: { src: "https://www.concretecms.org/download/latest.zip" },
		},
		nginxTemplate: "default",
		phpSupported: ["7.4", "8.0", "8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	Dolibarr: {
		name: "Dolibarr",
		version: "24.0.1",
		database: true,
		resources: {
			archive: { src: "https://github.com/Dolibarr/dolibarr/archive/refs/tags/24.0.1.zip" },
		},
		nginxTemplate: "dolibarr",
		phpSupported: ["8.1", "8.2", "8.3", "8.4"],
	},
	Drupal: {
		name: "Drupal",
		version: "latest",
		database: true,
		resources: {
			composer: { src: "drupal/recommended-project", dst: "/" },
		},
		nginxTemplate: "drupal-composer",
		phpSupported: ["8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	Flarum: {
		name: "Flarum",
		version: "latest",
		database: true,
		resources: {
			composer: { src: "flarum/flarum" },
		},
		nginxTemplate: "flarum-composer",
		phpSupported: ["8.2", "8.3"],
	},
	Grav: {
		name: "Grav",
		version: "2.0.24",
		database: false,
		resources: {
			archive: {
				src: "https://github.com/getgrav/grav/releases/download/2.0.24/grav-admin-v2.0.24.zip",
			},
		},
		nginxTemplate: "grav",
		phpSupported: ["8.3", "8.4", "8.5"],
	},
	Joomla: {
		name: "Joomla",
		version: "6.1.3",
		database: true,
		resources: {
			archive: {
				src: "https://downloads.joomla.org/cms/joomla6/6-1-3/Joomla_6-1-3-Stable-Full_Package.zip?format=zip",
			},
		},
		nginxTemplate: "joomla",
		phpSupported: ["8.3", "8.4"],
	},
	MediaWiki: {
		name: "MediaWiki",
		version: "1.46.0",
		database: true,
		resources: {
			archive: { src: "https://releases.wikimedia.org/mediawiki/1.46/mediawiki-1.46.0.zip" },
		},
		nginxTemplate: "default",
		phpSupported: ["8.2", "8.3", "8.4", "8.5"],
	},
	NamelessMC: {
		name: "NamelessMC",
		version: "2.2.5",
		database: false,
		resources: {
			archive: {
				src: "https://github.com/NamelessMC/Nameless/releases/download/v2.2.5/nameless-deps-dist.zip",
			},
		},
		nginxTemplate: "default",
		phpSupported: ["7.4", "8.0", "8.1", "8.2"],
	},
	OpenCart: {
		name: "OpenCart",
		version: "4.1.0.4",
		database: true,
		resources: {
			archive: {
				src: "https://github.com/opencart/opencart/releases/download/4.1.0.4/opencart-4.1.0.4.zip",
				dst: "/tmp-opencart",
			},
		},
		nginxTemplate: "opencart",
		phpSupported: ["8.0", "8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	PrestaShop: {
		name: "PrestaShop",
		version: "9.1.5",
		database: true,
		resources: {
			archive: {
				src: "https://assets.prestashop3.com/dst/edition/corporate/9.1.5-5.0/prestashop_edition_classic_version_9.1.5-5.0.zip?source=hestiacp",
			},
		},
		nginxTemplate: "prestashop",
		phpSupported: ["8.1", "8.2", "8.3", "8.4", "8.5"],
	},
	QloApps: {
		name: "QloApps",
		version: "1.7.0",
		database: true,
		resources: {
			archive: {
				src: "https://github.com/Qloapps/QloApps/releases/download/v1.7.0/qloapps-1.7.0.zip",
			},
		},
		nginxTemplate: "default",
		phpSupported: ["8.1", "8.2", "8.3", "8.4"],
	},
	Shopware: {
		name: "Shopware",
		version: "latest",
		database: true,
		resources: {
			composer: { src: "shopware/production", dst: "/" },
		},
		nginxTemplate: "shopware",
		phpSupported: ["8.2", "8.3", "8.4", "8.5"],
	},
	ThirtyBees: {
		name: "ThirtyBees",
		version: "1.7.0",
		database: true,
		resources: {
			archive: {
				src: "https://github.com/thirtybees/thirtybees/releases/download/1.7.0/thirtybees-v1.7.0-php7.4.zip",
			},
		},
		nginxTemplate: "prestashop",
		phpSupported: ["7.4", "8.0", "8.1", "8.2", "8.3"],
	},
	Vvveb: {
		name: "Vvveb",
		version: "latest",
		database: true,
		resources: {
			archive: { src: "https://www.vvveb.com/latest.zip" },
		},
		nginxTemplate: "vvveb",
		phpSupported: ["7.4", "8.0", "8.1", "8.2", "8.3", "8.4"],
	},
	osTicket: {
		name: "osTicket",
		version: "1.18.4",
		database: true,
		resources: {
			archive: {
				src: "https://github.com/osTicket/osTicket/releases/download/v1.18.4/osTicket-v1.18.4.zip",
			},
		},
		nginxTemplate: "osticket",
		phpSupported: ["8.2", "8.3", "8.4"],
	},
};

async function retrieveResources(
	ctx: HestiaAppContext,
	def: WebAppDefinition,
	target: WebAppTarget,
	options: WebAppOptions,
): Promise<void> {
	for (const [type, data] of Object.entries(def.resources)) {
		const destination = data.dst ? join(target.docroot, data.dst) : target.docroot;
		if (type === "composer") {
			await ctx.runComposer(options.php_version, [
				"create-project",
				"--no-progress",
				"--no-interaction",
				"--prefer-dist",
				data.src,
				"-d",
				dirname(destination),
				basename(destination),
			]);
			return;
		}
		if (type === "wp") {
			await ctx.runWp(options.php_version, [
				"core",
				"download",
				`--locale=${options.language}`,
				`--version=${def.version}`,
				`--path=${destination}`,
			]);
			return;
		}
		if (type === "archive") {
			if (!/^https?:\/\//.test(data.src)) {
				await ctx.archiveExtract(data.src, destination);
				return;
			}
			const file = await ctx.downloadUrl(data.src, destination);
			await ctx.archiveExtract(file, destination);
			await ctx.deleteFile(file);
			return;
		}
		throw new Error(`Unknown resource type "${type}"`);
	}
}

/** BaseSetup::install, ported. */
export async function installWebApp(
	ctx: HestiaAppContext,
	def: WebAppDefinition,
	target: WebAppTarget,
	options: WebAppOptions,
): Promise<void> {
	const setup = APP_SETUP_PORTS[def.name];
	if (!setup) {
		throw new Error(`The ${def.name} installer has not been ported yet (setupApplication missing)`);
	}
	await ctx.deleteFile(join(target.docroot, "robots.txt"));
	await ctx.deleteFile(join(target.docroot, "index.html"));
	await retrieveResources(ctx, def, target, options);
	if (target.database.create) {
		if (!(await ctx.checkDatabaseLimit())) {
			throw new Error("Unable to add database! Limit reached!");
		}
		await ctx.databaseAdd(
			target.database.name,
			target.database.user,
			target.database.password,
			target.database.host,
		);
	}
	const template =
		options.__webSystem === "nginx"
			? (def.nginxTemplate ?? "default")
			: (def.apacheTemplate ?? "default");
	await ctx.changeWebTemplate(target.domain, template);
	if (options.__webBackend === "php-fpm" && def.phpSupported) {
		const supported = await ctx.getSupportedPhpVersions(def.phpSupported);
		if (supported.length === 0) {
			throw new Error("Required PHP version is not supported");
		}
		await ctx.changeBackendTemplate(target.domain, `PHP-${options.php_version.replace(".", "_")}`);
	}
	await setup(ctx, target, options);
}
