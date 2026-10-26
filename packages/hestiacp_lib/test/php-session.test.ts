import { readFile, rm } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import type { HestiaConfig } from "../src/config";
import { PhpSessionStore, parsePhpSession, serializePhpSession } from "../src/php-session";

const config: HestiaConfig = {
	binDir: "/nonexistent",
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-php-sessions",
	sessionTimeoutSeconds: 1800,
};

const store = new PhpSessionStore(config);

afterAll(async () => {
	await rm(config.sessionDir, { recursive: true, force: true });
});

// A session string in exactly the format PHP's php_serialize handler writes.
const PHP_SAMPLE =
	'user|s:5:"admin";userContext|s:5:"admin";look|s:0:"";' +
	'token|s:32:"0123456789abcdef0123456789abcdef";' +
	'LAST_ACTIVITY|i:1760000000;INACTIVE_SESSION_TIMEOUT|s:4:"1800";' +
	'FILE_MANAGER|s:4:"true";DEBUG_MODE|b:0;error_msg|N;';

describe("PHP session serialization", () => {
	it("parses a real-format PHP session string", () => {
		const data = parsePhpSession(PHP_SAMPLE);
		expect(data.user).toBe("admin");
		expect(data.userContext).toBe("admin");
		expect(data.look).toBe("");
		expect(data.token).toBe("0123456789abcdef0123456789abcdef");
		expect(data.LAST_ACTIVITY).toBe(1760000000);
		expect(data.FILE_MANAGER).toBe("true");
		expect(data.DEBUG_MODE).toBe(false);
		expect(data.error_msg).toBeNull();
	});

	it("round-trips through serialize/parse, byte-lengths included", () => {
		const data = {
			user: "admïn-üser", // multibyte: s: length must be bytes, not chars
			count: 42,
			ratio: 1.5,
			enabled: true,
			nothing: null,
			list: ["a", "b"],
		};
		const text = serializePhpSession(data);
		expect(text).toContain(`s:${Buffer.byteLength("admïn-üser")}:`);
		expect(parsePhpSession(text)).toEqual(data);
	});

	it("serializes to the exact PHP byte format", () => {
		expect(serializePhpSession({ user: "admin", n: 7 })).toBe('user|s:5:"admin";n|i:7;');
	});
});

describe("PhpSessionStore", () => {
	it("writes sess_<id> files a PHP reader would find", async () => {
		const id = await store.create({
			user: "admin",
			userContext: "admin",
			LAST_ACTIVITY: Math.floor(Date.now() / 1000),
		});
		expect(id).toMatch(/^[a-f0-9]{32}$/);
		const raw = await readFile(`${config.sessionDir}/sess_${id}`, "utf8");
		expect(raw).toContain('user|s:5:"admin";');
		const data = await store.get(id);
		expect(data?.user).toBe("admin");
		await store.destroy(id);
		expect(await store.get(id)).toBeNull();
	});

	it("expires sessions past INACTIVE_SESSION_TIMEOUT from the record", async () => {
		const id = await store.create({
			user: "demo",
			LAST_ACTIVITY: Math.floor(Date.now() / 1000) - 10_000,
			INACTIVE_SESSION_TIMEOUT: "1800",
		});
		expect(await store.get(id)).toBeNull();
	});

	it("rejects path-shaped session ids", async () => {
		await expect(store.get("../../etc/passwd")).rejects.toThrow(/Invalid session id/);
	});
});
