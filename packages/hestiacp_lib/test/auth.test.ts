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
const LOG = "/tmp/hestiang-test-auth-calls.log";

const client = new HestiaClient({
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
} satisfies HestiaConfig);

beforeAll(async () => {
	process.env.HESTIA_FIXTURE_LOG = LOG;
	await rm(LOG, { force: true });
});

describe("two-factor authentication", () => {
	it("checkUser2fa delegates verification to v-check-user-2fa", async () => {
		expect(await client.checkUser2fa("secure", "123456")).toBe(true);
		expect(await client.checkUser2fa("secure", "000000")).toBe(false);
		const log = await readFile(LOG, "utf8");
		expect(log).toContain("v-check-user-2fa secure 123456");
	});

	it("add/delete 2fa call through", async () => {
		await client.addUser2fa("demo");
		await client.deleteUser2fa("demo");
		const log = await readFile(LOG, "utf8");
		expect(log).toContain("v-add-user-2fa demo");
		expect(log).toContain("v-delete-user-2fa demo");
	});

	it("the 2FA-enabled fixture user exposes TWOFA/QRCODE in its record", async () => {
		const record = await client.listUser("secure");
		expect(record.TWOFA).toBe("FIXTUREBASE32SECRET");
		expect(record.QRCODE).toContain("data:image/png");
	});
});

describe("audit logging", () => {
	it("logAction formats type/category/message as separate args", async () => {
		await client.logAction(
			"admin",
			"Info",
			"Security",
			"Logged in as another user (User: demo)",
		);
		const log = await readFile(LOG, "utf8");
		expect(log).toContain(
			"v-log-action admin Info Security Logged in as another user (User: demo)",
		);
	});

	it("logUserLogin includes the reason form when given", async () => {
		await client.logUserLogin(
			"secure",
			"127.0.0.1",
			"failed",
			"tok123",
			"probe-agent",
			"Invalid or missing 2FA token",
		);
		const log = await readFile(LOG, "utf8");
		expect(log).toContain(
			"v-log-user-login secure 127.0.0.1 failed tok123 probe-agent yes Invalid or missing 2FA token",
		);
	});
});
