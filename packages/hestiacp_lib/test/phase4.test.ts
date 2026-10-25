import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client";
import { JobStore, startJob } from "../src/jobs";
import {
	APP_SETUP_PORTS,
	HestiaAppContext,
	WEBAPP_DEFINITIONS,
	installWebApp,
	type PostRequestFn,
} from "../src/webapp";

const FIXTURES = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"bin",
);
const LOG = "/tmp/hestiang-test-p4-calls.log";
const client = new HestiaClient({ binDir: FIXTURES, useSudo: false });

async function calls(): Promise<string[]> {
	try {
		return (await readFile(LOG, "utf8")).trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

beforeAll(async () => {
	process.env.HESTIA_FIXTURE_LOG = LOG;
	await rm(LOG, { force: true });
});

describe("Phase 4 search + restic wrappers", () => {
	it("searches and manages restic snapshots", async () => {
		const global = await client.searchObjects("example");
		expect(global[0].TYPE).toBe("web");
		const own = await client.searchUserObjects("demo", "example");
		expect(own[0].TYPE).toBe("mail");
		const snaps = await client.listUserBackupsRestic("demo");
		expect(snaps.map((s) => s.ID)).toEqual(["snap001", "snap002"]);
		const detail = await client.listUserBackupRestic("demo", "snap001");
		expect(detail?.WEB).toBe("example.com");
		await client.scheduleUserBackupRestic("demo");
		await client.scheduleUserRestoreRestic("demo", "snap001");
		await client.scheduleUserRestoreRestic("demo", "snap001", "web", "example.com");
		await client.deleteUserBackupRestic("demo", "snap002");
		const lines = await calls();
		expect(lines).toEqual([
			"v-schedule-user-backup-restic demo",
			"v-schedule-user-restore-restic demo snap001",
			"v-schedule-user-restore-restic demo snap001 web example.com",
			"v-delete-user-backup-restic demo snap002",
		]);
	});
});

describe("JobStore / startJob", () => {
	let dir: string;
	afterAll(async () => {
		await rm(dir, { recursive: true, force: true });
	});
	it("browses a restic snapshot (JSON-lines)", async () => {
		const before = await calls();
		const { info, files } = await client.listUserFilesRestic("demo", "snap001", "/home/demo");
		expect((await calls()).at(-1)).toBe(
			"v-list-user-files-restic demo snap001 /home/demo",
		);
		expect(info.short_id).toBe("snap001");
		expect(files.map((f) => f.name)).toEqual([
			"demo",
			"web",
			"conf",
			"readme.txt",
			"link",
		]);
		expect(files[3].type).toBe("file");
		expect(files[3].size).toBe(128);
	});

	it("persists running → done and running → failed", async () => {
		dir = await mkdtemp(join(tmpdir(), "hestiang-jobs-test-"));
		const store = new JobStore(dir);
		const ok = await startJob(store, "ok-job", { app: "WordPress" }, async () => {
			await new Promise((r) => setTimeout(r, 10));
		});
		const bad = await startJob(store, "bad-job", undefined, async () => {
			throw new Error("boom");
		});
		await new Promise((r) => setTimeout(r, 60));
		expect((await store.get(ok.id))?.status).toBe("done");
		const failed = await store.get(bad.id);
		expect(failed?.status).toBe("failed");
		expect(failed?.error).toBe("boom");
		const list = await store.list();
		expect(list.map((j) => j.name).sort()).toEqual(["bad-job", "ok-job"]);
	});
});

describe("WebApp framework port", () => {
	it("runs the WordPress install sequence against fixtures", async () => {
		const before = (await calls()).length;
		const posts: Array<{ url: string; data: Record<string, string> }> = [];
		const post: PostRequestFn = async (url, data) => {
			posts.push({ url, data });
		};
		const ctx = new HestiaAppContext(client, "demo", post);
		await installWebApp(
			ctx,
			WEBAPP_DEFINITIONS.WordPress,
			{
				domain: "example.com",
				docroot: "/home/demo/web/example.com/public_html",
				url: "https://example.com",
				ssl: true,
				database: {
					create: true,
					name: "demo_wp",
					user: "demo_wp",
					password: "db-secret",
					host: "localhost",
				},
			},
			{
				php_version: "8.4",
				language: "en_US",
				site_name: "My Blog",
				username: "wpadmin",
				password: "admin-secret",
				email: "a@example.com",
				install_directory: "",
				__webSystem: "nginx",
				__webBackend: "php-fpm",
			},
		);
		const lines = (await calls()).slice(before);
		expect(lines[0]).toBe(
			"v-delete-fs-file demo /home/demo/web/example.com/public_html/robots.txt",
		);
		expect(lines[1]).toBe(
			"v-delete-fs-file demo /home/demo/web/example.com/public_html/index.html",
		);
		expect(lines[2]).toBe("v-add-user-wp-cli demo yes");
		expect(lines[3]).toBe(
			"v-run-cli-cmd demo /usr/bin/php8.4 /home/demo/.wp-cli/wp core download --locale=en_US --version=latest --path=/home/demo/web/example.com/public_html",
		);
		expect(lines[4]).toMatch(
			/^v-add-database demo wp wp \/tmp\/hestiang-stage-\S+\/staged mysql localhost utf8mb4$/,
		);
		expect(lines[4]).not.toContain("db-secret");
		expect(lines[5]).toBe("v-change-web-domain-tpl demo example.com wordpress");
		expect(lines[6]).toBe(
			"v-change-web-domain-backend-tpl demo example.com PHP-8_4",
		);
		expect(lines[7]).toBe("v-add-user-wp-cli demo yes");
		expect(lines[8]).toMatch(
			/^v-run-cli-cmd demo \/usr\/bin\/php8\.4 \/home\/demo\/\.wp-cli\/wp config create --dbname=demo_wp --dbuser=demo_wp --dbpass=db-secret --dbhost=localhost --dbprefix=wp_[A-Za-z0-9]{5}_ --dbcharset=utf8mb4 --locale=en_US --path=\/home\/demo\/web\/example\.com\/public_html$/,
		);
		expect(posts).toHaveLength(1);
		expect(posts[0].url).toBe("https://example.com/wp-admin/install.php?step=2");
		expect(posts[0].data.weblog_title).toBe("My Blog");
	});

	it("runs the DokuWiki install sequence against fixtures", async () => {
		const before = (await calls()).length;
		const posts: Array<{ url: string; data: Record<string, string> }> = [];
		const ctx = new HestiaAppContext(client, "demo", async (url, data) => {
			posts.push({ url, data });
		});
		await installWebApp(
			ctx,
			WEBAPP_DEFINITIONS.DokuWiki,
			{
				domain: "example.com",
				docroot: "/home/demo/web/example.com/public_html",
				url: "https://example.com",
				ssl: true,
				database: { create: false, name: "", user: "", password: "", host: "" },
			},
			{
				php_version: "8.4",
				wiki_name: "My Wiki",
				superuser: "boss",
				real_name: "Boss Person",
				email: "b@example.com",
				password: "wiki-secret",
				initial_ACL_policy: "1: Public Wiki",
				content_license: "cc-by-sa: CC Attribution",
				__webSystem: "nginx",
				__webBackend: "php-fpm",
			},
		);
		const lines = (await calls()).slice(before);
		// archive resource: wget via cli cmd, extract, delete the tarball
		expect(lines[2]).toBe(
			"v-run-cli-cmd demo /usr/bin/wget --tries 3 --timeout=30 --no-dns-cache -nv https://download.dokuwiki.org/src/dokuwiki/dokuwiki-stable.tgz -P /home/demo/web/example.com/public_html",
		);
		expect(lines[3]).toBe(
			"v-extract-fs-archive demo /home/demo/web/example.com/public_html/dokuwiki-stable.tgz /home/demo/web/example.com/public_html  1",
		);
		expect(lines[4]).toBe(
			"v-delete-fs-file demo /home/demo/web/example.com/public_html/dokuwiki-stable.tgz",
		);
		expect(lines[5]).toBe("v-change-web-domain-tpl demo example.com dokuwiki");
		expect(lines[6]).toBe(
			"v-change-web-domain-backend-tpl demo example.com PHP-8_4",
		);
		expect(lines[7]).toBe(
			"v-move-fs-file demo /home/demo/web/example.com/public_html/.htaccess.dist /home/demo/web/example.com/public_html/.htaccess",
		);
		expect(lines[8]).toBe(
			"v-delete-fs-file demo /home/demo/web/example.com/public_html/install.php",
		);
		expect(posts[0].data["d[policy]"]).toBe("1");
		expect(posts[0].data["d[license]"]).toBe("cc-by-sa");
	});

	it("refuses apps without a ported setupApplication", async () => {
		expect(APP_SETUP_PORTS.NotAnApp).toBeUndefined();
		const ctx = new HestiaAppContext(client, "demo", async () => {});
		await expect(
			installWebApp(
				ctx,
				{
					name: "NotAnApp",
					version: "latest",
					database: true,
					resources: {},
				},
				{
					domain: "example.com",
					docroot: "/home/demo/web/example.com/public_html",
					url: "https://example.com",
				ssl: true,
					database: { create: false, name: "", user: "", password: "", host: "" },
				},
				{ php_version: "8.4" },
			),
		).rejects.toThrow(/not been ported/);
	});
});
