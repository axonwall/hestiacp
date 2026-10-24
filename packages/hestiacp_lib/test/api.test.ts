import { readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { handleApiRequest } from "../src/api";
import { HestiaClient } from "../src/client";
import type { HestiaConfig } from "../src/config";

const fixturesBin = join(
	dirname(fileURLToPath(import.meta.url)),
	"fixtures",
	"bin",
);

const config: HestiaConfig = {
	binDir: fixturesBin,
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions",
	sessionTimeoutSeconds: 1800,
};
const client = new HestiaClient(config);
const IP = "127.0.0.1";

afterAll(async () => {
	delete process.env.HESTIA_FIXTURE_CONFIG;
	await rm("/tmp/hestiang-api-tmpfile.txt", { force: true });
});

describe("legacy API flow", () => {
	it("authenticates root by password and dispatches", async () => {
		const res = await handleApiRequest(
			client,
			{
				user: "admin",
				password: "spike-fixture-secret",
				cmd: "v-list-users",
				arg1: "json",
			},
			IP,
		);
		expect(res.exitCode).toBe(0);
		expect(res.httpStatus).toBe(200);
		expect(res.body).toContain('"demo"');
	});

	it("rejects a bad password with E_PASSWORD mapped to 401", async () => {
		const res = await handleApiRequest(
			client,
			{ user: "admin", password: "wrong", cmd: "v-list-users" },
			IP,
		);
		expect(res.exitCode).toBe(9);
		expect(res.httpStatus).toBe(401);
	});

	it("rejects non-root users in the legacy flow", async () => {
		const res = await handleApiRequest(
			client,
			{ user: "demo", password: "spike-fixture-secret", cmd: "v-list-users" },
			IP,
		);
		expect(res.exitCode).toBe(10);
	});

	it("authenticates by legacy hash", async () => {
		const res = await handleApiRequest(
			client,
			{ hash: "fixture-hash-value", cmd: "v-list-sys-config", arg1: "json" },
			IP,
		);
		expect(res.exitCode).toBe(0);
		expect(res.body).toContain("1.10.5");
	});

	it("returncode=yes returns the exit code as the body", async () => {
		const res = await handleApiRequest(
			client,
			{
				user: "admin",
				password: "spike-fixture-secret",
				cmd: "v-list-users",
				arg1: "json",
				returncode: "yes",
			},
			IP,
		);
		expect(res.body).toBe("0");
	});

	it("implements v-make-tmp-file in-process", async () => {
		const res = await handleApiRequest(
			client,
			{
				user: "admin",
				password: "spike-fixture-secret",
				cmd: "v-make-tmp-file",
				arg1: "cluster-payload",
				arg2: "hestiang-api-tmpfile.txt",
			},
			IP,
		);
		expect(res.exitCode).toBe(0);
		const written = await readFile("/tmp/hestiang-api-tmpfile.txt", "utf8");
		expect(written).toBe("cluster-payload\n");
	});

	it("v-make-tmp-file cannot escape /tmp via arg2", async () => {
		const res = await handleApiRequest(
			client,
			{
				user: "admin",
				password: "spike-fixture-secret",
				cmd: "v-make-tmp-file",
				arg1: "x",
				arg2: "../../tmp/hestiang-api-tmpfile.txt",
			},
			IP,
		);
		// basename() collapses the traversal to the same in-/tmp file.
		expect(res.exitCode).toBe(0);
		const written = await readFile("/tmp/hestiang-api-tmpfile.txt", "utf8");
		expect(written).toBe("x\n");
	});
});

describe("access-key API flow", () => {
	it("authenticates a root key and dispatches", async () => {
		const res = await handleApiRequest(
			client,
			{
				access_key: "AKROOT",
				secret_key: "root-secret",
				cmd: "v-list-users",
				arg1: "json",
			},
			IP,
		);
		expect(res.exitCode).toBe(0);
		expect(res.body).toContain('"admin"');
	});

	it("enforces the key-user argument position for non-root keys", async () => {
		const ok = await handleApiRequest(
			client,
			{
				access_key: "AKDEMO",
				secret_key: "demo-secret",
				cmd: "v-list-user",
				arg1: "demo",
				arg2: "json",
			},
			IP,
		);
		expect(ok.exitCode).toBe(0);

		const mismatch = await handleApiRequest(
			client,
			{
				access_key: "AKDEMO",
				secret_key: "demo-secret",
				cmd: "v-list-user",
				arg1: "admin",
				arg2: "json",
			},
			IP,
		);
		expect(mismatch.exitCode).toBe(10);
		expect(mismatch.httpStatus).toBe(401);
	});

	it("accepts an access key embedded in the hash field (PHP form)", async () => {
		const res = await handleApiRequest(
			client,
			{
				hash: `${"A".repeat(20)}:${"B".repeat(40)}`,
				cmd: "v-list-users",
				arg1: "json",
			},
			IP,
		);
		expect(res.exitCode).toBe(0);
		expect(res.body).toContain('"admin"');

		const bad = await handleApiRequest(
			client,
			{
				hash: `${"A".repeat(20)}:${"C".repeat(40)}`,
				cmd: "v-list-users",
			},
			IP,
		);
		expect(bad.exitCode).toBe(9);
	});

	it("rejects a bad secret", async () => {
		const res = await handleApiRequest(
			client,
			{
				access_key: "AKROOT",
				secret_key: "nope",
				cmd: "v-list-users",
			},
			IP,
		);
		expect(res.exitCode).toBe(9);
	});
});

describe("API config gates", () => {
	it("refuses everything when the API is disabled in sys config", async () => {
		const alt = "/tmp/hestiang-fixture-config-off.json";
		await writeFile(
			alt,
			JSON.stringify({
				config: {
					ROOT_USER: "admin",
					API: "no",
					API_SYSTEM: "0",
					API_ALLOWED_IP: "allow-all",
				},
			}),
		);
		process.env.HESTIA_FIXTURE_CONFIG = alt;
		try {
			const legacy = await handleApiRequest(
				client,
				{
					user: "admin",
					password: "spike-fixture-secret",
					cmd: "v-list-users",
				},
				IP,
			);
			expect(legacy.exitCode).toBe(11);
			const keyed = await handleApiRequest(
				client,
				{
					access_key: "AKROOT",
					secret_key: "root-secret",
					cmd: "v-list-users",
				},
				IP,
			);
			expect(keyed.exitCode).toBe(11);
		} finally {
			delete process.env.HESTIA_FIXTURE_CONFIG;
			await rm(alt, { force: true });
		}
	});
});
