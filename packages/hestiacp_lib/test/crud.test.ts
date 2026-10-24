import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client";
import type { HestiaConfig } from "../src/config";

const fixturesBin = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"bin",
);
const LOG = "/tmp/hestiang-test-crud-calls.log";
process.env.HESTIA_FIXTURE_LOG = LOG;

const client = new HestiaClient({
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
} satisfies HestiaConfig);

async function calls(): Promise<string[]> {
	try {
		return (await readFile(LOG, "utf8")).trim().split("\n").filter(Boolean);
	} catch {
		return [];
	}
}

beforeAll(async () => {
	await rm(LOG, { force: true });
});

describe("Phase 3 CRUD wrappers", () => {
	it("reads singular records and enumerations", async () => {
		expect((await client.listWebDomain("demo", "example.com")).TPL).toBe(
			"default",
		);
		expect((await client.listDnsDomain("demo", "example.com")).SOA).toBe(
			"ns1.example.com",
		);
		expect(
			(await client.listMailDomain("demo", "example.com")).DKIM_SELECTOR,
		).toBe("mail");
		expect((await client.listMailAccount("demo", "example.com", "info")).ALIAS).toBe(
			"postmaster",
		);
		expect((await client.listDatabase("demo", "demo_main")).TYPE).toBe("mysql");
		expect((await client.listCronJob("demo", "1")).CMD).toBe("/usr/bin/backup.sh");
		expect(await client.listWebTemplates()).toEqual(["default", "caching"]);
		expect(await client.listDnsTemplates()).toEqual(["default", "child-ns"]);
		expect(Object.keys(await client.listDatabaseHosts())).toEqual(["localhost"]);
		expect(
			await client.listMailAccountAutoreply("demo", "example.com", "info"),
		).toBe("I am out of office.");
		// NAT resolution (web/add semantics)
		expect(await client.publicIpFor("demo", "203.0.113.10")).toBe("198.51.100.23");
		expect(await client.publicIpFor("demo", "192.0.2.1")).toBe("192.0.2.1");
	});

	it("adds a web domain with DNS + mail in PHP's order and arg shape", async () => {
		const before = (await calls()).length;
		await client.addWebDomain("demo", "new.example.com", "203.0.113.10", {
			dns: true,
			mail: true,
		});
		const lines = (await calls()).slice(before);
		expect(lines[0]).toBe(
			"v-add-web-domain demo new.example.com 203.0.113.10 yes",
		);
		// DNS zone gets the NAT (public) IP and PHP's eight blank NS slots
		expect(lines[1]).toBe(
			"v-add-dns-domain demo new.example.com 198.51.100.23" + " ".repeat(9) + "no",
		);
		expect(lines[2]).toBe("v-add-mail-domain demo new.example.com");
	});

	it("issues web edit commands with the pages' argument orders", async () => {
		const before = (await calls()).length;
		await client.changeWebDomainIp("demo", "example.com", "203.0.113.11");
		await client.changeWebDomainTpl("demo", "example.com", "caching");
		await client.addWebDomainAlias("demo", "example.com", "www2.example.com");
		await client.setWebDomainSslForce("demo", "example.com", true);
		await client.setWebDomainStats("demo", "example.com", "", "awstats");
		await client.unsuspendWebDomain("demo", "example.com");
		const lines = (await calls()).slice(before);
		expect(lines).toEqual([
			"v-change-web-domain-ip demo example.com 203.0.113.11 no",
			// DNS zone exists in fixtures -> moved to the same public IP
			"v-change-dns-domain-ip demo example.com 203.0.113.11 no",
			"v-change-web-domain-tpl demo example.com caching no",
			"v-add-web-domain-alias demo example.com www2.example.com no",
			"v-add-web-domain-ssl-force demo example.com",
			"v-add-web-domain-stats demo example.com awstats",
			"v-unsuspend-domain demo example.com",
		]);
	});

	it("runs DNS domain + record flows, then restarts on request", async () => {
		const before = (await calls()).length;
		await client.addDnsDomain("demo", "zone.example.com", "203.0.113.10", ["ns1.example.com", "ns2.example.com"], true);
		await client.changeDnsRecord("demo", "example.com", "2", "www", "A", "203.0.113.10", "", "3600");
		await client.suspendDnsRecord("demo", "example.com", "3");
		await client.restartDns();
		const lines = (await calls()).slice(before);
		expect(lines[0]).toBe(
			"v-add-dns-domain demo zone.example.com 203.0.113.10 ns1.example.com ns2.example.com" +
				" ".repeat(7) +
				"no yes",
		);
		expect(lines[1]).toBe(
			"v-change-dns-record demo example.com 2 www A 203.0.113.10  yes 3600",
		);
		expect(lines[2]).toBe("v-suspend-dns-record demo example.com 3");
		expect(lines[3]).toBe("v-restart-dns");
	});

	it("runs mail domain + account flows with staged secrets", async () => {
		const before = (await calls()).length;
		await client.addMailDomain("demo", "mail.example.com", {
			antispam: true,
			antivirus: false,
			dkim: true,
			dkimSelector: "mail",
		});
		await client.addMailAccount("demo", "example.com", "newbox", "s3cret-fixture", "250");
		await client.changeMailAccountQuota("demo", "example.com", "info", "");
		await client.deleteMailAccountForward("demo", "example.com", "info", ":blackhole:");
		const lines = (await calls()).slice(before);
		expect(lines[0]).toBe(
			"v-add-mail-domain demo mail.example.com yes no yes 2048   mail",
		);
		// Secret is staged: argv carries a /tmp path, never the secret
		expect(lines[1]).toMatch(
			/^v-add-mail-account demo example\.com newbox \/tmp\/hestiang-stage-[^ ]+\/staged 250$/,
		);
		expect(lines[1]).not.toContain("s3cret-fixture");
		expect(lines[2]).toBe("v-change-mail-account-quota demo example.com info 0");
		expect(lines[3]).toBe(
			"v-delete-mail-account-forward demo example.com info :blackhole:",
		);
	});

	it("runs database and cron flows", async () => {
		const before = (await calls()).length;
		await client.addDatabase("demo", "shop", "shopuser", "db-secret-fixture", "mysql", "localhost", "utf8mb4");
		await client.changeDatabaseUser("demo", "demo_main", "demo_new");
		await client.addCronJob("demo", "30", "4", "*", "*", "1-5", "/usr/bin/report.sh");
		await client.deleteCronJob("demo", "2");
		const lines = (await calls()).slice(before);
		expect(lines[0]).toMatch(
			/^v-add-database demo shop shopuser \/tmp\/hestiang-stage-[^ ]+\/staged mysql localhost utf8mb4$/,
		);
		expect(lines[0]).not.toContain("db-secret-fixture");
		expect(lines[1]).toBe("v-change-database-user demo demo_main demo_new");
		expect(lines[2]).toBe("v-add-cron-job demo 30 4 * * 1-5 /usr/bin/report.sh");
		expect(lines[3]).toBe("v-delete-cron-job demo 2");
	});
});
