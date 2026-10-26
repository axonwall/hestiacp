import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client";
import type { HestiaConfig } from "../src/config";

const fixturesBin = join(dirname(fileURLToPath(import.meta.url)), "fixtures", "bin");
const client = new HestiaClient({
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
} satisfies HestiaConfig);

describe("Phase 2 list wrappers", () => {
	it("reads the per-user domain lists", async () => {
		expect(Object.keys(await client.listWebDomains("demo"))).toEqual([
			"example.com",
			"blog.example.com",
		]);
		expect((await client.listWebDomains("demo"))["example.com"].SSL).toBe("yes");
		expect(Object.keys(await client.listDnsDomains("demo"))).toEqual(["example.com"]);
		const records = await client.listDnsRecords("demo", "example.com");
		expect(records["3"].TYPE).toBe("MX");
		expect(records["3"].PRIORITY).toBe("10");
		expect(Object.keys(await client.listMailDomains("demo"))).toEqual(["example.com"]);
		expect(Object.keys(await client.listMailAccounts("demo", "example.com"))).toEqual([
			"info",
			"admin",
		]);
		expect(Object.keys(await client.listDatabases("demo"))).toEqual(["demo_main"]);
		expect((await client.listCronJobs("demo"))["2"].CMD).toContain("cron.php");
		expect(Object.keys(await client.listUserBackups("demo"))[0]).toContain(".tar");
		expect((await client.listUserSshKeys("demo"))["1"].KEY).toContain("demo@laptop");
		expect((await client.listAccessKeys("demo"))["fixturekey1"].USER).toBe("demo");
		expect((await client.listUserLog("demo"))["1"].CATEGORY).toBe("Web");
		expect((await client.listUserNotifications("demo"))["1"].ACK).toBe("no");
		const stats = await client.listUserStats("demo");
		expect(stats["2026-10-31"].U_BANDWIDTH).toBe("2048");
	});

	it("reads the server/admin lists", async () => {
		expect((await client.listSysServices()).mysqld.STATE).toBe("stopped");
		const info = await client.listSysInfo();
		expect(info.HOSTNAME).toBe("panel.example.test");
		expect(info.VERSION).toBe("24.04");
		expect(info.HESTIA).toBe("1.10.5");
		expect(Object.keys(await client.listSysIps())).toEqual(["203.0.113.10"]);
		expect((await client.listFirewallRules())["2"].ACTION).toBe("DROP");
		expect(Object.keys(await client.listFirewallBan())).toEqual(["198.51.100.7"]);
		expect((await client.listFirewallIpset()).blocklist.AUTOUPDATE).toBe("yes");
		expect((await client.listSysHestiaUpdates())["hestia-php"].UPDATED).toBe("yes");
		expect(Object.keys(await client.listSysRrd())).toEqual(["1", "2", "3"]);
	});

	it("rejects invalid usernames on user-scoped lists", () => {
		// The wrappers are non-async: validation throws synchronously,
		// before any command is spawned.
		expect(() => client.listWebDomains("../etc")).toThrow("Invalid username");
	});
});
