import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { HestiaClient } from "../src/client.js";
import type { HestiaConfig } from "../src/config.js";

const fixturesBin = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"bin",
);
const callLog = "/tmp/hestiang-fixture-calls.log";

const config: HestiaConfig = {
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
};

const client = new HestiaClient(config);

beforeAll(async () => {
	await rm(callLog, { force: true });
	process.env.HESTIA_FIXTURE_CALL_LOG = callLog;
});

afterAll(async () => {
	await rm(callLog, { force: true });
});

describe("HestiaClient against fixture v-* commands", () => {
	it("lists users from v-list-users json", async () => {
		const users = await client.listUsers();
		expect(Object.keys(users).sort()).toEqual(["admin", "demo"]);
		expect(users.admin.NAME).toBe("Administrator");
		expect(users.demo.DATABASES).toBe("1");
	});

	it("fetches a single user and rejects unknown users", async () => {
		const demo = await client.listUser("demo");
		expect(demo.PACKAGE).toBe("default");
		await expect(client.listUser("nosuch")).rejects.toThrow(/exited 9/);
	});

	it("rejects invalid usernames before spawning anything", async () => {
		await expect(client.listUser("../etc")).rejects.toThrow(
			/Invalid username/,
		);
		await expect(client.listUser("-rf")).rejects.toThrow(/Invalid username/);
	});

	it("verifies the fixture password via the /tmp secret-file pattern", async () => {
		await expect(
			client.verifyUserPassword("admin", "spike-fixture-secret"),
		).resolves.toBe(true);
		await expect(client.verifyUserPassword("admin", "wrong")).resolves.toBe(
			false,
		);
		await expect(
			client.verifyUserPassword("demo", "spike-fixture-secret"),
		).resolves.toBe(false);
	});

	it("records the spike edit at the command layer", async () => {
		await client.changeUserName("demo", "Renamed", "Person");
		const log = await readFile(callLog, "utf8");
		expect(log).toContain("v-change-user-name demo Renamed Person");
	});
});
