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
	ROLE: string;
	SHELL: string;
	LANGUAGE: string;
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
	 * Stage contents in a 0600 temp file under /tmp, run fn with its path,
	 * and always remove the file afterwards. This is the panel's one staging
	 * pattern (see the Phase 0 audit): several v-* commands take a file path
	 * argument for secrets and definitions; func/main.sh only treats ^/tmp/
	 * paths as file references, so staging anywhere else is refused.
	 */
	async withStagedFile<T>(
		contents: string,
		fn: (path: string) => Promise<T>,
	): Promise<T> {
		if (!tmpdir().startsWith("/tmp")) {
			throw new Error("withStagedFile requires os.tmpdir() under /tmp");
		}
		const dir = await mkdtemp(join(tmpdir(), "hestiang-stage-"));
		const path = join(dir, "staged");
		try {
			await writeFile(path, contents, { mode: 0o600 });
			return await fn(path);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}

	/**
	 * Verify a user's password the way the PHP panel does for yescrypt:
	 * the secret is staged to a file and the *path* is passed to
	 * v-check-user-password (is_password_valid swaps in the file contents).
	 * The password therefore never appears in argv.
	 */
	async verifyUserPassword(
		user: string,
		secret: string,
		ip = "127.0.0.1",
	): Promise<boolean> {
		assertUsername(user);
		const result = await this.withStagedFile(`${secret}\n`, (path) =>
			this.raw("v-check-user-password", user, path, ip),
		);
		return result.code === 0;
	}

	/**
	 * Verify a precomputed password hash via v-check-user-hash, with the
	 * hash staged to a file (is_hash_valid). This is the legacy API's
	 * `hash` authentication mode.
	 */
	async checkUserHash(
		user: string,
		hash: string,
		ip = "127.0.0.1",
	): Promise<boolean> {
		assertUsername(user);
		const result = await this.withStagedFile(`${hash}\n`, (path) =>
			this.raw("v-check-user-hash", user, path, ip),
		);
		return result.code === 0;
	}

	/** The spike's one edit: change a user's full name (v-change-user-name USER FIRST [LAST]). */
	async changeUserName(
		user: string,
		firstName: string,
		lastName?: string,
	): Promise<void> {
		assertUsername(user);
		const args = [user, firstName, ...(lastName ? [lastName] : [])];
		await this.runChecked("v-change-user-name", ...args);
	}

	/** Run a command and throw a descriptive error on a non-zero exit. */
	private async runChecked(command: string, ...args: string[]): Promise<void> {
		const result = await this.raw(command, ...args);
		if (result.code !== 0) {
			throw new Error(
				`${command} exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
			);
		}
	}

	// ---- User administration (Phase 1) ----

	/**
	 * Create a user, mirroring web/add/user: v-add-user with the secret
	 * staged to a file (never in argv), then language / role /
	 * login-disabled applied via their own commands when requested.
	 */
	async addUser(opts: AddUserOptions): Promise<void> {
		assertUsername(opts.user);
		await this.withStagedFile(`${opts.secret}\n`, (path) =>
			this.runChecked(
				"v-add-user",
				opts.user,
				path,
				opts.email,
				opts.package,
				opts.name,
			),
		);
		if (opts.language) {
			await this.changeUserLanguage(opts.user, opts.language);
		}
		if (opts.role) {
			await this.changeUserRole(opts.user, opts.role);
		}
		if (opts.loginDisabled) {
			await this.changeUserConfigValue(opts.user, "LOGIN_DISABLED", "yes");
		}
	}

	/** Change a user's password; the secret is staged, never in argv. */
	async changeUserPassword(user: string, secret: string): Promise<void> {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (path) =>
			this.runChecked("v-change-user-password", user, path),
		);
	}

	async changeUserContact(user: string, email: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-contact", user, email);
	}

	async changeUserPackage(user: string, pkg: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-package", user, pkg);
	}

	async changeUserLanguage(user: string, language: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-language", user, language);
	}

	async changeUserShell(user: string, shell: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-shell", user, shell);
	}

	async changeUserRole(user: string, role: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-role", user, role);
	}

	async changeUserTheme(user: string, theme: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-theme", user, theme);
	}

	/** v-change-user-ns takes each nameserver as its own argument. */
	async changeUserNs(user: string, ns: string[]): Promise<void> {
		assertUsername(user);
		const servers = ns.map((s) => s.trim()).filter(Boolean);
		if (servers.length === 0) {
			throw new Error("changeUserNs requires at least one nameserver");
		}
		await this.runChecked("v-change-user-ns", user, ...servers);
	}

	async changeUserConfigValue(
		user: string,
		key: string,
		value: string,
	): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-user-config-value", user, key, value);
	}

	async suspendUser(user: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-suspend-user", user, "yes");
	}

	async unsuspendUser(user: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-unsuspend-user", user, "yes");
	}

	async deleteUser(user: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-delete-user", user);
	}

	// ---- Packages (Phase 1) ----

	async listUserPackages(): Promise<Record<string, HestiaPackage>> {
		return this.json<Record<string, HestiaPackage>>(
			"v-list-user-packages",
			"json",
		);
	}

	async listUserPackage(name: string): Promise<HestiaPackage> {
		const data = await this.json<Record<string, HestiaPackage>>(
			"v-list-user-package",
			name,
			"json",
		);
		return data[name] ?? (data as unknown as HestiaPackage);
	}

	/**
	 * Create (or, with force, overwrite) a user package: the definition is
	 * serialized to the KEY='value' file format the bash layer reads,
	 * staged, and handed to v-add-user-package by path.
	 */
	async addUserPackage(
		name: string,
		fields: Record<string, string>,
		force = false,
	): Promise<void> {
		const contents = serializeUserPackage(fields);
		await this.withStagedFile(contents, (path) =>
			this.runChecked(
				"v-add-user-package",
				...[path, name, ...(force ? ["yes"] : [])],
			),
		);
	}

	async deleteUserPackage(name: string): Promise<void> {
		await this.runChecked("v-delete-user-package", name);
	}

	// ---- System enumerations used by admin forms ----

	async listSysLanguages(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-sys-languages", "json"));
	}

	async listSysShells(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-sys-shells", "json"));
	}

	async listSysThemes(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-sys-themes", "json"));
	}
}

export interface AddUserOptions {
	user: string;
	secret: string;
	email: string;
	package: string;
	/** Full name as one string, as v-add-user's $5 (it appends $6 if given). */
	name: string;
	language?: string;
	role?: string;
	loginDisabled?: boolean;
}

/** One user package (v-list-user-package[s]); values are strings. */
export interface HestiaPackage {
	WEB_TEMPLATE: string;
	DNS_TEMPLATE: string;
	WEB_DOMAINS: string;
	WEB_ALIASES: string;
	DNS_DOMAINS: string;
	DNS_RECORDS: string;
	MAIL_DOMAINS: string;
	MAIL_ACCOUNTS: string;
	DATABASES: string;
	CRON_JOBS: string;
	DISK_QUOTA: string;
	BANDWIDTH: string;
	NS: string;
	SHELL: string;
	BACKUPS: string;
	[key: string]: string;
}

/** Field order of a serialized package file, mirroring web/add/package. */
export const USER_PACKAGE_FIELDS = [
	"WEB_TEMPLATE",
	"BACKEND_TEMPLATE",
	"PROXY_TEMPLATE",
	"DNS_TEMPLATE",
	"WEB_DOMAINS",
	"WEB_ALIASES",
	"DNS_DOMAINS",
	"DNS_RECORDS",
	"MAIL_DOMAINS",
	"MAIL_ACCOUNTS",
	"DATABASES",
	"CRON_JOBS",
	"DISK_QUOTA",
	"CPU_QUOTA",
	"CPU_QUOTA_PERIOD",
	"MEMORY_LIMIT",
	"SWAP_LIMIT",
	"BANDWIDTH",
	"RATE_LIMIT",
	"NS",
	"SHELL",
	"BACKUPS",
	"BACKUPS_INCREMENTAL",
] as const;

/**
 * Serialize package fields to the KEY='value' line format v-add-user-package
 * consumes. TIME/DATE are stamped here, as the PHP page stamps them.
 * Values containing a single quote or newline are rejected — they cannot
 * be represented safely in this format (and never occur in real fields).
 */
export function serializeUserPackage(fields: Record<string, string>): string {
	const now = new Date();
	const pad = (n: number) => String(n).padStart(2, "0");
	const stamped: Record<string, string> = {
		...fields,
		TIME: `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
		DATE: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
	};
	const lines: string[] = [];
	for (const key of [...USER_PACKAGE_FIELDS, "TIME", "DATE"]) {
		const value = stamped[key];
		if (value === undefined) continue;
		if (/['\n\r]/.test(value)) {
			throw new Error(`Package field ${key} contains an illegal character`);
		}
		lines.push(`${key}='${value}'`);
	}
	return `${lines.join("\n")}\n`;
}

/** v-list-sys-* enumerations come as either a JSON array or a code→label map. */
function normalizeStringList(data: unknown): string[] {
	if (Array.isArray(data)) return data.map((v) => String(v));
	if (data && typeof data === "object") return Object.keys(data);
	return [];
}
