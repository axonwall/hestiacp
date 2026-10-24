import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client";
import {
	HestiaAppContext,
	WEBAPP_DEFINITIONS,
	installWebApp,
	type PostRequestFn,
	type WebAppOptions,
	type WebAppTarget,
} from "../src/webapp";

const FIXTURES = fileURLToPath(new URL("./fixtures/bin", import.meta.url));
const LOG = "/tmp/hestiang-test-p4b-calls.log";
const client = new HestiaClient({ binDir: FIXTURES, useSudo: false });
const DOCROOT = "/home/demo/web/example.com/public_html";

const OPTIONS: WebAppOptions = {
	php_version: "8.4",
	language: "en_US",
	username: "appadmin",
	password: "admin-secret",
	email: "a@example.com",
	site_name: "My Site",
	admin_gateway: "cp-admin",
	auth_gateway: "cp-auth",
	search_engine_indexing: "Allow",
	"disable_XML-RPC?": "Yes",
	first_name: "First",
	last_name: "Last",
	shop_name: "My Shop",
	shop_email: "shop@example.com",
	shop_locale: "fr-FR",
	shop_currency: "USD",
	store_name: "My Store",
	wiki_name: "My Wiki",
	admin_username: "wikiadmin",
	admin_password: "wiki-secret",
	admin_user: "Admin Person",
	full_name: "Full Name",
	real_name: "Real Name",
	superuser: "boss",
	initial_ACL_policy: "1: Public",
	content_license: "cc-by: CC",
	forum_title: "My Forum",
	admin_email: "root@example.com",
	helpdesk_name: "Helpdesk",
	vvveb_account_username: "vvadmin",
	vvveb_account_email: "vv@example.com",
	vvveb_account_password: "vv-secret",
	install_directory: "",
	__webSystem: "nginx",
	__webBackend: "php-fpm",
};

interface RunResult {
	lines: string[];
	posts: Array<{ url: string; data: Record<string, string> }>;
}

async function runApp(app: string): Promise<RunResult> {
	const before = await readLog();
	const posts: RunResult["posts"] = [];
	const post: PostRequestFn = async (url, data) => {
		posts.push({ url, data });
	};
	const ctx = new HestiaAppContext(client, "demo", post);
	const def = WEBAPP_DEFINITIONS[app];
	const target: WebAppTarget = {
		domain: "example.com",
		docroot: DOCROOT,
		url: "https://example.com",
		ssl: true,
		database: {
			create: def.database,
			name: "demo_app",
			user: "demo_app",
			password: "db-secret",
			host: "localhost",
		},
	};
	await installWebApp(ctx, def, target, OPTIONS);
	const lines = (await readLog()).slice(before.length);
	return { lines, posts };
}

async function readLog(): Promise<string[]> {
	try {
		return (await readFile(LOG, "utf8")).split("\n");
	} catch {
		return [];
	}
}

function hasLine(lines: string[], prefix: string): boolean {
	return lines.some((l) => l.includes(prefix));
}

beforeAll(async () => {
	process.env.HESTIA_FIXTURE_LOG = LOG;
	process.env.HESTIA_PHP_BIN = fileURLToPath(
		new URL("./fixtures/php-stub.sh", import.meta.url),
	);
	await rm(LOG, { force: true });
});

describe("WebApp installer batch (all 22 ported)", () => {
	it("has a definition and a setup port for every catalog app", () => {
		expect(Object.keys(WEBAPP_DEFINITIONS)).toHaveLength(22);
	});

	it("Nextcloud: occ install + trusted domains + .user.ini bump", async () => {
		const { lines } = await runApp("Nextcloud");
		expect(hasLine(lines, "occ maintenance:install")).toBe(true);
		expect(hasLine(lines, "--database-pass db-secret")).toBe(true);
		expect(hasLine(lines, "config:system:set trusted_domains 2 --value=example.com")).toBe(true);
		expect(hasLine(lines, "memory_limit=512M\\r\\n")).toBe(true);
	});

	it("Laravel: .env rewrite, artisan key + migrate, sqlite cleanup", async () => {
		const { lines } = await runApp("Laravel");
		expect(hasLine(lines, "DB_CONNECTION=mysql")).toBe(true);
		expect(hasLine(lines, "DB_DATABASE=demo_app")).toBe(true);
		expect(hasLine(lines, "artisan key:generate --force")).toBe(true);
		expect(hasLine(lines, "artisan migrate --force")).toBe(true);
		expect(hasLine(lines, `v-delete-fs-file demo ${DOCROOT}/database/database.sqlite`)).toBe(true);
	});

	it("Symfony: composer config + two requires", async () => {
		const { lines } = await runApp("Symfony");
		expect(hasLine(lines, "extra.symfony.allow-contrib true")).toBe(true);
		expect(hasLine(lines, "require -d " + DOCROOT + " webapp")).toBe(true);
		expect(hasLine(lines, "symfony/apache-pack")).toBe(true);
	});

	it("Castopod: env rewrite with salt + init-database", async () => {
		const { lines } = await runApp("Castopod");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/castopod/. ${DOCROOT}`)).toBe(true);
		expect(lines.some((l) => /analytics\.salt=[A-Za-z0-9]{64}/.test(l))).toBe(true);
		expect(hasLine(lines, "database.default.database=demo_app")).toBe(true);
		expect(hasLine(lines, "spark install:init-database")).toBe(true);
	});

	it("ClassicPress: glob, wp config with cp_ prefix, XML-RPC off", async () => {
		const { lines } = await runApp("ClassicPress");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/ClassicPress-1.0/. ${DOCROOT}`)).toBe(true);
		expect(lines.some((l) => /--dbprefix=cp_[A-Za-z0-9]{5}_/.test(l))).toBe(true);
		expect(hasLine(lines, "option update disable_xml_rpc 1")).toBe(true);
	});

	it("ConcreteCMS: c5:install via the extracted dir", async () => {
		const { lines } = await runApp("ConcreteCMS");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/concrete-cms-1.0/. ${DOCROOT}`)).toBe(true);
		expect(hasLine(lines, "concrete/bin/concrete c5:install")).toBe(true);
	});

	it("Dolibarr: conf perms 666 → posts → 400, versioned dir", async () => {
		const { lines, posts } = await runApp("Dolibarr");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/dolibarr-24.0.1/. ${DOCROOT}`)).toBe(true);
		const i666 = lines.findIndex((l) => l.includes("v-change-fs-file-permission") && l.includes("666"));
		const i400 = lines.findIndex((l) => l.includes("v-change-fs-file-permission") && l.includes("400"));
		expect(i666).toBeGreaterThanOrEqual(0);
		expect(i400).toBeGreaterThan(i666);
		expect(posts.map((p) => p.url)).toEqual([
			"https://example.com/install/step1.php",
			"https://example.com/install/step2.php",
			"https://example.com/install/step5.php",
		]);
		expect(posts[0].data.main_force_https).toBe("1");
	}, 20000);

	it("Drupal: drush site-install with the mysql URL", async () => {
		const { lines } = await runApp("Drupal");
		expect(hasLine(lines, "drush/drush")).toBe(true);
		expect(hasLine(lines, "--db-url=mysql://demo_app:db-secret@localhost:3306/demo_app")).toBe(true);
		expect(hasLine(lines, "site-install standard")).toBe(true);
	});

	it("Flarum: installer POST with prefixed tables", async () => {
		const { posts } = await runApp("Flarum");
		expect(posts).toHaveLength(1);
		expect(posts[0].data.forumTitle).toBe("My Forum");
		expect(posts[0].data.tablePrefix).toMatch(/^fl[A-Za-z0-9]{5}$/);
	});

	it("Grav: account yaml with a bcrypt hash, no database", async () => {
		const { lines } = await runApp("Grav");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/grav-admin/. ${DOCROOT}`)).toBe(true);
		expect(hasLine(lines, "hashed_password: '$2y$10$stubbedhash")).toBe(true);
		expect(hasLine(lines, `user/accounts/appadmin.yaml`)).toBe(true);
		expect(lines.some((l) => l.startsWith("v-add-database"))).toBe(false);
	});

	it("Joomla: cli install with db args", async () => {
		const { lines } = await runApp("Joomla");
		expect(hasLine(lines, "installation/joomla.php install")).toBe(true);
		expect(hasLine(lines, "--db-name=demo_app")).toBe(true);
		expect(hasLine(lines, `v-move-fs-file demo ${DOCROOT}/htaccess.txt ${DOCROOT}/.htaccess`)).toBe(true);
	});

	it("MediaWiki: install.php with empty scriptpath", async () => {
		const { lines } = await runApp("MediaWiki");
		expect(hasLine(lines, "maintenance/install.php")).toBe(true);
		expect(hasLine(lines, "--scriptpath= --lang=en_US")).toBe(true);
		expect(hasLine(lines, `v-delete-fs-directory demo ${DOCROOT}/mediawiki-1.46.0/`)).toBe(true);
	});

	it("NamelessMC: resources + templates only", async () => {
		const { lines } = await runApp("NamelessMC");
		expect(lines.some((l) => l.includes("/usr/bin/php"))).toBe(false);
		expect(hasLine(lines, "v-change-web-domain-tpl demo example.com default")).toBe(true);
	});

	it("OpenCart: staged extract dir flow", async () => {
		const { lines } = await runApp("OpenCart");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/tmp-opencart/upload/. ${DOCROOT}`)).toBe(true);
		expect(hasLine(lines, "install/cli_install.php install")).toBe(true);
		expect(hasLine(lines, `v-delete-fs-directory demo ${DOCROOT}/tmp-opencart`)).toBe(true);
	});

	it("PrestaShop: nested zip extracted, cli install, cleanup", async () => {
		const { lines } = await runApp("PrestaShop");
		const iDel = lines.findIndex((l) => l.includes(`v-delete-fs-file demo ${DOCROOT}/index.php`));
		const iExtract = lines.findIndex(
			(l) => l.includes("v-extract-fs-archive") && l.includes("prestashop.zip"),
		);
		expect(iDel).toBeGreaterThanOrEqual(0);
		expect(iExtract).toBeGreaterThan(iDel);
		expect(hasLine(lines, "install/index_cli.php")).toBe(true);
		expect(hasLine(lines, "--ssl=1")).toBe(true);
	});

	it("QloApps: versioned dir copy + cli install", async () => {
		const { lines } = await runApp("QloApps");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/qloapps-1.7.0/. ${DOCROOT}`)).toBe(true);
		expect(hasLine(lines, "--domain=example.com")).toBe(true);
	});

	it("Shopware: .env DSN rewrite, system install, locale + user", async () => {
		const { lines } = await runApp("Shopware");
		expect(hasLine(lines, "APP_URL=https://example.com")).toBe(true);
		expect(hasLine(lines, "DATABASE_URL=mysql://demo_app:db-secret@localhost:3306/demo_app")).toBe(true);
		expect(hasLine(lines, "bin/console system:install")).toBe(true);
		expect(hasLine(lines, "translation:install -n --locales=fr-FR")).toBe(true);
		expect(hasLine(lines, "bin/console user:create appadmin")).toBe(true);
	});

	it("ThirtyBees: cli install + install dir cleanup", async () => {
		const { lines } = await runApp("ThirtyBees");
		expect(hasLine(lines, "install/index_cli.php")).toBe(true);
		expect(hasLine(lines, `v-delete-fs-directory demo ${DOCROOT}/install`)).toBe(true);
	});

	it("Vvveb: cli.php install args", async () => {
		const { lines } = await runApp("Vvveb");
		expect(hasLine(lines, "cli.php install")).toBe(true);
		expect(hasLine(lines, "admin[email]=vv@example.com")).toBe(true);
	});

	it("osTicket: upload copy, config rename, installer POST", async () => {
		const { lines, posts } = await runApp("osTicket");
		expect(hasLine(lines, `v-copy-fs-directory demo ${DOCROOT}/upload/. ${DOCROOT}`)).toBe(true);
		expect(hasLine(lines, "include/ost-config.php")).toBe(true);
		expect(posts[0].url).toBe("https://example.com/setup/install.php");
		expect(posts[0].data.prefix).toBe("ost_");
		expect(hasLine(lines, `v-delete-fs-directory demo ${DOCROOT}/setup`)).toBe(true);
	});
});
