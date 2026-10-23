import { readFile, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";
import { HestiaClient, serializeUserPackage } from "../src/client";
import type { HestiaConfig } from "../src/config";

const fixturesBin = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"bin",
);
const LOG = "/tmp/hestiang-test-admin-calls.log";

const config: HestiaConfig = {
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
};
const client = new HestiaClient(config);

beforeAll(async () => {
	process.env.HESTIA_FIXTURE_LOG = LOG;
	await rm(LOG, { force: true });
	await rm(`${LOG}.pkg`, { force: true });
});

async function callLog(): Promise<string> {
	try {
		return await readFile(LOG, "utf8");
	} catch {
		return "";
	}
}

describe("user administration", () => {
	it("addUser stages the secret (path arg under /tmp, content = secret)", async () => {
		await client.addUser({
			user: "newhire",
			secret: "N3wHire!Fixture",
			email: "hire@example.com",
			package: "small",
			name: "New Hire",
			language: "de",
			role: "user",
			loginDisabled: true,
		});
		const log = await callLog();
		const addLine = log
			.split("\n")
			.find((l) => l.startsWith("v-add-user newhire"));
		expect(addLine).toBeDefined();
		// The second argument is a /tmp path, and the secret never appears.
		expect(addLine).toMatch(/v-add-user newhire \/tmp\/\S+ hire@example\.com small New Hire/);
		expect(log).not.toContain("N3wHire!Fixture");
		// Follow-up commands ran, in PHP's order.
		expect(log).toContain("v-change-user-language newhire de");
		expect(log).toContain("v-change-user-role newhire user");
		expect(log).toContain(
			"v-change-user-config-value newhire LOGIN_DISABLED yes",
		);
	});

	it("changeUserPassword stages the secret the same way", async () => {
		await client.changeUserPassword("demo", "An0ther!Fixture");
		const log = await callLog();
		expect(log).toMatch(/v-change-user-password demo \/tmp\/\S+/);
		expect(log).not.toContain("An0ther!Fixture");
	});

	it("suspend / unsuspend / delete call through", async () => {
		await client.suspendUser("demo");
		await client.unsuspendUser("demo");
		await client.deleteUser("demo");
		const log = await callLog();
		expect(log).toContain("v-suspend-user demo yes");
		expect(log).toContain("v-unsuspend-user demo yes");
		expect(log).toContain("v-delete-user demo");
	});

	it("changeUserNs passes each nameserver as its own argument", async () => {
		await client.changeUserNs("demo", [
			"ns1.example.com",
			" ns2.example.com ",
			"",
		]);
		expect(await callLog()).toContain(
			"v-change-user-ns demo ns1.example.com ns2.example.com",
		);
	});
});

describe("packages", () => {
	it("lists packages and reads one package", async () => {
		const all = await client.listUserPackages();
		expect(Object.keys(all).sort()).toEqual(["default", "small"]);
		expect(all.small.WEB_DOMAINS).toBe("5");
		const one = await client.listUserPackage("small");
		expect(one.DISK_QUOTA).toBe("1000");
	});

	it("serializeUserPackage emits the PHP field order with quoted values", () => {
		const text = serializeUserPackage({
			WEB_TEMPLATE: "default",
			WEB_DOMAINS: "5",
			NS: "ns1.example.com,ns2.example.com",
		});
		const lines = text.trim().split("\n");
		expect(lines[0]).toBe("WEB_TEMPLATE='default'");
		expect(lines).toContain("WEB_DOMAINS='5'");
		expect(lines).toContain("NS='ns1.example.com,ns2.example.com'");
		expect(lines.at(-2)).toMatch(/^TIME='\d{2}:\d{2}:\d{2}'$/);
		expect(lines.at(-1)).toMatch(/^DATE='\d{4}-\d{2}-\d{2}'$/);
	});

	it("serializeUserPackage rejects unquotable values", () => {
		expect(() =>
			serializeUserPackage({ WEB_TEMPLATE: "x'; rm -rf" }),
		).toThrow(/illegal character/);
	});

	it("addUserPackage stages a serialized definition", async () => {
		await client.addUserPackage("tiny", {
			WEB_TEMPLATE: "default",
			WEB_DOMAINS: "2",
			DISK_QUOTA: "250",
		});
		expect(await callLog()).toMatch(/v-add-user-package \/tmp\/\S+ tiny$/m);
		const staged = await readFile(`${LOG}.pkg`, "utf8");
		expect(staged).toContain("WEB_DOMAINS='2'");
		expect(staged).toContain("DISK_QUOTA='250'");
	});

	it("addUserPackage with force passes yes; delete calls through", async () => {
		await client.addUserPackage("tiny", { WEB_TEMPLATE: "default" }, true);
		expect(await callLog()).toMatch(/v-add-user-package \/tmp\/\S+ tiny yes$/m);
		await client.deleteUserPackage("tiny");
		expect(await callLog()).toContain("v-delete-user-package tiny");
	});
});

describe("system enumerations", () => {
	it("normalizes map-shaped and array-shaped lists", async () => {
		expect(await client.listSysLanguages()).toEqual(["en", "de", "fr"]);
		expect(await client.listSysShells()).toEqual([
			"bash",
			"nologin",
			"rssh",
			"rbash",
		]);
		expect(await client.listSysThemes()).toEqual([
			"default",
			"dark",
			"vestia",
		]);
	});
});
