import { readFile, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client";

const FIXTURES = fileURLToPath(new URL("./fixtures/bin", import.meta.url));
const LOG = "/tmp/hestiang-test-rest-calls.log";
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

describe("Phase 3 remainder wrappers", () => {
	it("handles stats users, backups and exclusions", async () => {
		await client.addWebDomainStatsUser("demo", "example.com", "statsboss", "stats-secret");
		await client.deleteWebDomainStatsUser("demo", "example.com");
		await client.scheduleUserBackup("demo");
		await client.scheduleUserRestore("demo", "demo.2026-10-01_00-00-00.tar");
		await client.scheduleUserRestore("demo", "demo.2026-10-01_00-00-00.tar", {
			web: "example.com", dns: "no", mail: "no", db: "no", cron: "yes", udir: "no",
		});
		await client.deleteUserBackup("demo", "demo.2026-10-01_00-00-00.tar");
		await client.updateUserBackupExclusions("demo", { WEB: "public_html/cache" });
		const lines = await calls();
		expect(lines[0]).toMatch(
			/^v-add-web-domain-stats-user demo example\.com statsboss \/tmp\/hestiang-stage-\S+\/staged$/,
		);
		expect(lines[0]).not.toContain("stats-secret");
		expect(lines[1]).toBe("v-delete-web-domain-stats-user demo example.com");
		expect(lines[2]).toBe("v-schedule-user-backup demo");
		expect(lines[3]).toBe(
			"v-schedule-user-restore demo demo.2026-10-01_00-00-00.tar",
		);
		expect(lines[4]).toBe(
			"v-schedule-user-restore demo demo.2026-10-01_00-00-00.tar example.com no no no yes no",
		);
		expect(lines[5]).toBe("v-delete-user-backup demo demo.2026-10-01_00-00-00.tar");
		expect(lines[6]).toMatch(
			/^v-update-user-backup-exclusions demo \/tmp\/hestiang-stage-\S+\/staged$/,
		);
		const detail = await client.listUserBackup("demo", "demo.2026-10-01_00-00-00.tar");
		expect(detail?.WEB).toBe("example.com");
		const exclusions = await client.listUserBackupExclusions("demo");
		expect(exclusions.WEB).toBe("public_html/cache,logs");
	});

	it("handles firewall rules, bans, ipsets and sys IPs", async () => {
		const before = (await calls()).length;
		await client.addFirewallRule("ACCEPT", "203.0.113.5", "22", "TCP", "ssh");
		await client.changeFirewallRule("1", "DROP", "0.0.0.0/0", "23", "TCP", "Block telnet");
		await client.deleteFirewallRule("1");
		await client.addFirewallBan("198.51.100.9", "INPUT");
		await client.deleteFirewallBan("198.51.100.9", "INPUT");
		await client.addFirewallIpset("blocklist", "file:/tmp/list.txt", "v4", "yes");
		await client.deleteFirewallIpset("blocklist");
		await client.addSysIp("203.0.113.20", "255.255.255.0", "eth0", "admin", "shared", "", "");
		await client.changeSysIpStatus("203.0.113.20", "dedicated");
		await client.deleteSysIp("203.0.113.20");
		const lines = (await calls()).slice(before);
		expect(lines).toEqual([
			"v-add-firewall-rule ACCEPT 203.0.113.5 22 TCP ssh",
			"v-change-firewall-rule 1 DROP 0.0.0.0/0 23 TCP Block telnet",
			"v-delete-firewall-rule 1",
			"v-add-firewall-ban 198.51.100.9 INPUT",
			"v-delete-firewall-ban 198.51.100.9 INPUT",
			"v-add-firewall-ipset blocklist file:/tmp/list.txt v4 yes",
			"v-delete-firewall-ipset blocklist",
			"v-add-sys-ip 203.0.113.20 255.255.255.0 eth0 admin shared  ",
			"v-change-sys-ip-status 203.0.113.20 dedicated",
			"v-delete-sys-ip 203.0.113.20",
		]);
		const rule = await client.listFirewallRule("1");
		expect(rule?.ACTION).toBe("DROP");
	});

	it("handles server settings, service configs and backup hosts", async () => {
		const before = (await calls()).length;
		await client.changeSysHostname("panel.example.com");
		await client.changeSysTimezone("America/Chicago");
		await client.changeSysLanguage("en");
		await client.changeSysLanguage("de", true);
		await client.changeSysConfigValue("BACKUP_MODE", "zstd");
		await client.changeSysServiceConfig("nginx", "worker_processes 1;\n", true);
		await client.restartService("nginx");
		await client.addBackupHost("sftp", "backup.example.net", "bkup", "host-secret", "/backups", "22");
		await client.deleteBackupHost("sftp");
		await client.addBackupHostRestic("sftp:bkup@backup.example.net:/repo", "5", "7", "4", "6", "2");
		const lines = (await calls()).slice(before);
		expect(lines[0]).toBe("v-change-sys-hostname panel.example.com");
		expect(lines[1]).toBe("v-change-sys-timezone America/Chicago");
		expect(lines[2]).toBe("v-change-sys-language en");
		expect(lines[3]).toBe("v-change-sys-language de yes");
		expect(lines[4]).toBe("v-change-sys-config-value BACKUP_MODE zstd");
		expect(lines[5]).toMatch(
			/^v-change-sys-service-config \/tmp\/hestiang-stage-\S+\/staged nginx yes$/,
		);
		expect(lines[6]).toBe("v-restart-service nginx yes");
		expect(lines[7]).toMatch(
			/^v-add-backup-host sftp backup\.example\.net bkup \/tmp\/hestiang-stage-\S+\/staged \/backups 22$/,
		);
		expect(lines[7]).not.toContain("host-secret");
		expect(lines[8]).toBe("v-delete-backup-host sftp");
		expect(lines[9]).toBe(
			"v-add-backup-host-restic sftp:bkup@backup.example.net:/repo 5 7 4 6 2",
		);
		expect(await client.getSysTimezones()).toContain("America/Chicago");
		expect(await client.openFsConfig("/etc/nginx/nginx.conf")).toContain(
			"fixture config contents",
		);
		const hosts = await client.listBackupHosts();
		expect(hosts.sftp.HOST).toBe("backup.example.net");
	});
});
