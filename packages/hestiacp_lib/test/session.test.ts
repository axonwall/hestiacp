import { rm } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import type { HestiaConfig } from "../src/config.js";
import { SessionStore } from "../src/session.js";

const config: HestiaConfig = {
	binDir: "/nonexistent",
	useSudo: false,
	sessionDir: "/tmp/hestiang-test-sessions-store",
	sessionTimeoutSeconds: 1800,
};

const store = new SessionStore(config);

afterAll(async () => {
	await rm(config.sessionDir, { recursive: true, force: true });
});

describe("SessionStore", () => {
	it("creates, reads, and destroys a session", async () => {
		const id = await store.create({
			user: "admin",
			userContext: "admin",
			ip: "127.0.0.1",
			createdAt: Date.now(),
			lastSeenAt: Date.now(),
		});
		const session = await store.get(id);
		expect(session?.user).toBe("admin");
		expect(session?.userContext).toBe("admin");
		await store.destroy(id);
		expect(await store.get(id)).toBeNull();
	});

	it("signs cookie values and rejects tampering", async () => {
		const id = await store.create({
			user: "demo",
			userContext: "user",
			ip: "127.0.0.1",
			createdAt: Date.now(),
			lastSeenAt: Date.now(),
		});
		const cookie = await store.cookieValueFor(id);
		expect(await store.idFromCookie(cookie)).toBe(id);
		expect(await store.idFromCookie(`${id}.deadbeef`)).toBeNull();
		expect(await store.idFromCookie("garbage")).toBeNull();
		expect(await store.idFromCookie(undefined)).toBeNull();
		await store.destroy(id);
	});

	it("expires sessions past the inactivity timeout", async () => {
		const shortStore = new SessionStore({
			...config,
			sessionTimeoutSeconds: 1,
		});
		const id = await shortStore.create({
			user: "demo",
			userContext: "user",
			ip: "127.0.0.1",
			createdAt: Date.now() - 10_000,
			lastSeenAt: Date.now() - 10_000,
		});
		expect(await shortStore.get(id)).toBeNull();
	});
});
