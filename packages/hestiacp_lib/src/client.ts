import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HestiaConfig } from "./config";
import { loadConfig } from "./config";
import { runHestiaCommand, type CommandResult } from "./exec";

/** One row of v-list-users / v-list-user JSON output. Values are strings, as emitted. */
export interface HestiaUser {
	NAME: string;
	PACKAGE: string;
	WEB_DOMAINS: string;
	DNS_DOMAINS: string;
	MAIL_DOMAINS: string;
	DATABASES: string;
	CRON_JOBS: string;
	DISK_QUOTA: string;
	SUSPENDED: string;
	[key: string]: string;
}

const USERNAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

export function assertUsername(user: string): void {
	if (!USERNAME_PATTERN.test(user)) {
		throw new Error(`Invalid username: ${user}`);
	}
}

/**
 * Typed client for the HestiaCP command layer. Every method is a thin,
 * validated wrapper over one v-* command; the client never touches Hestia's
 * .conf files directly — the bash layer owns state, exactly as with the PHP
 * panel.
 */
export class HestiaClient {
	readonly config: HestiaConfig;

	constructor(config: HestiaConfig = loadConfig()) {
		this.config = config;
	}

	raw(command: string, ...args: string[]): Promise<CommandResult> {
		return runHestiaCommand(this.config, command, args);
	}

	async json<T>(command: string, ...args: string[]): Promise<T> {
		const result = await this.raw(command, ...args);
		if (result.code !== 0) {
			throw new Error(
				`${command} exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
			);
		}
		return JSON.parse(result.stdout) as T;
	}

	async listUsers(): Promise<Record<string, HestiaUser>> {
		return this.json<Record<string, HestiaUser>>("v-list-users", "json");
	}

	async listUser(user: string): Promise<HestiaUser> {
		assertUsername(user);
		const data = await this.json<Record<string, HestiaUser>>(
			"v-list-user",
			user,
			"json",
		);
		const record = data[user];
		if (!record) {
			throw new Error(`v-list-user returned no record for ${user}`);
		}
		return record;
	}

	async listSysConfig(): Promise<Record<string, Record<string, string>>> {
		return this.json("v-list-sys-config", "json");
	}

	/**
	 * Verify a user's password the way the PHP panel does for yescrypt:
	 * the secret is written to a 0600 temp file under /tmp and the *path* is
	 * passed to v-check-user-password (func/main.sh's is_password_valid swaps
	 * in the file contents). The password therefore never appears in argv,
	 * and the file is removed immediately afterwards.
	 */
	async verifyUserPassword(
		user: string,
		secret: string,
		ip = "127.0.0.1",
	): Promise<boolean> {
		assertUsername(user);
		if (!tmpdir().startsWith("/tmp")) {
			// v-check-user-password only treats ^/tmp/ paths as secret files.
			// Refuse to fall back to passing the secret on the command line.
			throw new Error("verifyUserPassword requires os.tmpdir() under /tmp");
		}
		const dir = await mkdtemp(join(tmpdir(), "hestiang-auth-"));
		const secretPath = join(dir, "secret");
		try {
			await writeFile(secretPath, `${secret}\n`, { mode: 0o600 });
			const result = await this.raw(
				"v-check-user-password",
				user,
				secretPath,
				ip,
			);
			return result.code === 0;
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}

	/** The spike's one edit: change a user's full name (v-change-user-name USER FIRST [LAST]). */
	async changeUserName(
		user: string,
		firstName: string,
		lastName?: string,
	): Promise<void> {
		assertUsername(user);
		const args = [user, firstName, ...(lastName ? [lastName] : [])];
		const result = await this.raw("v-change-user-name", ...args);
		if (result.code !== 0) {
			throw new Error(
				`v-change-user-name exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
			);
		}
	}
}
