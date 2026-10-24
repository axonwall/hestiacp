import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { HestiaConfig } from "./config";
import { loadConfig } from "./config";
import { runHestiaCommand, type CommandResult } from "./exec";

/** One flat row of any v-list-* JSON map. Values are strings, as emitted. */
export type HestiaRow = Record<string, string>;

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
	 * Generic read for the panel's list views: nearly every v-list-*
	 * command with `json` returns a map keyed by the row's primary name
	 * or id, values being flat string records. The Phase 2 list pages
	 * render these directly; typed wrappers below name each view's call.
	 */
	async listRows(
		command: string,
		...args: string[]
	): Promise<Record<string, HestiaRow>> {
		return this.json<Record<string, HestiaRow>>(command, ...args, "json");
	}

	/* ---- Per-user domain lists (Phase 2 read-only views) ---- */

	listWebDomains(user: string) {
		assertUsername(user);
		return this.listRows("v-list-web-domains", user);
	}
	listDnsDomains(user: string) {
		assertUsername(user);
		return this.listRows("v-list-dns-domains", user);
	}
	listDnsRecords(user: string, domain: string) {
		assertUsername(user);
		return this.listRows("v-list-dns-records", user, domain);
	}
	listMailDomains(user: string) {
		assertUsername(user);
		return this.listRows("v-list-mail-domains", user);
	}
	listMailAccounts(user: string, domain: string) {
		assertUsername(user);
		return this.listRows("v-list-mail-accounts", user, domain);
	}
	listDatabases(user: string) {
		assertUsername(user);
		return this.listRows("v-list-databases", user);
	}
	listCronJobs(user: string) {
		assertUsername(user);
		return this.listRows("v-list-cron-jobs", user);
	}
	listUserBackups(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-backups", user);
	}
	listUserSshKeys(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-ssh-key", user);
	}
	listAccessKeys(user: string) {
		assertUsername(user);
		return this.listRows("v-list-access-keys", user);
	}
	listUserLog(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-log", user);
	}
	listUserNotifications(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-notifications", user);
	}
	listUserStats(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-stats", user);
	}

	/* ---- Server / admin lists ---- */

	listSysServices() {
		return this.listRows("v-list-sys-services");
	}
	/** v-list-sys-info returns one flat record, not a map of rows. */
	async listSysInfo(): Promise<HestiaRow> {
		return this.json<HestiaRow>("v-list-sys-info", "json");
	}
	listSysIps() {
		return this.listRows("v-list-sys-ips");
	}
	listFirewallRules() {
		return this.listRows("v-list-firewall");
	}
	listFirewallBan() {
		return this.listRows("v-list-firewall-ban");
	}
	listFirewallIpset() {
		return this.listRows("v-list-firewall-ipset");
	}
	listSysHestiaUpdates() {
		return this.listRows("v-list-sys-hestia-updates");
	}
	listSysRrd() {
		return this.listRows("v-list-sys-rrd");
	}

	/* ==================================================================
	 * Phase 3 — CRUD by domain. Argument orders mirror the PHP pages
	 * (web/add|edit|delete| suspend/<domain>) exactly; multi-step flows
	 * follow the pages' sequencing. Secrets are staged, never argv.
	 * ================================================================== */

	/** Fetch one record from a singular v-list-* command. */
	private async listOne(
		command: string,
		key: string,
		...args: string[]
	): Promise<HestiaRow> {
		const data = await this.json<Record<string, HestiaRow>>(
			command,
			...args,
			"json",
		);
		const record = data[key];
		if (!record) throw new Error(`${command} returned no record for ${key}`);
		return record;
	}

	listWebDomain(user: string, domain: string) {
		assertUsername(user);
		return this.listOne("v-list-web-domain", domain, user, domain);
	}
	listDnsDomain(user: string, domain: string) {
		assertUsername(user);
		return this.listOne("v-list-dns-domain", domain, user, domain);
	}
	listMailDomain(user: string, domain: string) {
		assertUsername(user);
		return this.listOne("v-list-mail-domain", domain, user, domain);
	}
	listMailAccount(user: string, domain: string, account: string) {
		assertUsername(user);
		return this.listOne(
			"v-list-mail-account",
			account,
			user,
			domain,
			account,
		);
	}
	listDatabase(user: string, database: string) {
		assertUsername(user);
		return this.listOne("v-list-database", database, user, database);
	}
	listCronJob(user: string, job: string) {
		assertUsername(user);
		return this.listOne("v-list-cron-job", job, user, job);
	}
	/** User IPs as a map keyed by IP ({ NAT, ... }) — web/add's source. */
	listUserIps(user: string) {
		assertUsername(user);
		return this.listRows("v-list-user-ips", user);
	}
	/** The public (NAT) address for an IP, or the IP itself — as web/add. */
	async publicIpFor(user: string, ip: string): Promise<string> {
		const ips = await this.listUserIps(user).catch(() => null);
		const nat = ips?.[ip]?.NAT?.trim();
		return nat ? nat : ip;
	}
	async listWebTemplates(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-web-templates", "json"));
	}
	async listWebTemplatesBackend(): Promise<string[]> {
		return normalizeStringList(
			await this.json("v-list-web-templates-backend", "json"),
		);
	}
	async listWebTemplatesProxy(): Promise<string[]> {
		return normalizeStringList(
			await this.json("v-list-web-templates-proxy", "json"),
		);
	}
	async listDnsTemplates(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-dns-templates", "json"));
	}
	async listWebStatsSystems(): Promise<string[]> {
		return normalizeStringList(await this.json("v-list-web-stats", "json"));
	}
	/** Database hosts as a map keyed by hostname ({ TYPE, CHARSETS, ... }). */
	listDatabaseHosts() {
		return this.listRows("v-list-database-hosts");
	}
	/** Autoreply text is a plain-text command, not JSON. */
	async listMailAccountAutoreply(
		user: string,
		domain: string,
		account: string,
	): Promise<string> {
		assertUsername(user);
		const result = await this.raw(
			"v-list-mail-account-autoreply",
			user,
			domain,
			account,
		);
		return result.code === 0 ? result.stdout.replace(/\n$/, "") : "";
	}

	/* ---- Web domains ---- */

	/**
	 * v-add-web-domain (+ the add page's optional DNS and mail domains).
	 * The DNS domain is created with the IP's public/NAT address, exactly
	 * as web/add/web resolves it.
	 */
	async addWebDomain(
		user: string,
		domain: string,
		ip: string,
		opts: { dns?: boolean; mail?: boolean } = {},
	): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-add-web-domain", user, domain, ip, "yes");
		if (opts.dns) {
			const publicIp = await this.publicIpFor(user, ip);
			await this.runChecked(
				"v-add-dns-domain",
				user,
				domain,
				publicIp,
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"",
				"no",
			);
		}
		if (opts.mail) {
			await this.runChecked("v-add-mail-domain", user, domain);
		}
	}
	/** IP change; also moves the DNS zone when one exists (edit/web). */
	async changeWebDomainIp(
		user: string,
		domain: string,
		ip: string,
	): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-change-web-domain-ip", user, domain, ip, "no");
		const dns = await this.listDnsDomain(user, domain).catch(() => null);
		if (dns) {
			const publicIp = await this.publicIpFor(user, ip);
			await this.runChecked(
				"v-change-dns-domain-ip",
				user,
				domain,
				publicIp,
				"no",
			);
		}
	}
	async changeWebDomainTpl(user: string, domain: string, tpl: string) {
		assertUsername(user);
		await this.runChecked("v-change-web-domain-tpl", user, domain, tpl, "no");
	}
	async changeWebDomainBackendTpl(user: string, domain: string, tpl: string) {
		assertUsername(user);
		await this.runChecked("v-change-web-domain-backend-tpl", user, domain, tpl);
	}
	/** Proxy enable (add) / template+ext change, per edit/web. */
	async addWebDomainProxy(
		user: string,
		domain: string,
		tpl: string,
		ext: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-web-domain-proxy",
			user,
			domain,
			tpl,
			ext,
			"no",
		);
	}
	async changeWebDomainProxyTpl(
		user: string,
		domain: string,
		tpl: string,
		ext: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-web-domain-proxy-tpl",
			user,
			domain,
			tpl,
			ext,
			"no",
		);
	}
	async deleteWebDomainProxy(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-web-domain-proxy", user, domain, "no");
	}
	async addWebDomainAlias(user: string, domain: string, alias: string) {
		assertUsername(user);
		await this.runChecked("v-add-web-domain-alias", user, domain, alias, "no");
	}
	async deleteWebDomainAlias(user: string, domain: string, alias: string) {
		assertUsername(user);
		await this.runChecked(
			"v-delete-web-domain-alias",
			user,
			domain,
			alias,
			"no",
		);
	}
	async addLetsEncryptDomain(
		user: string,
		domain: string,
		aliasesCsv: string,
		keyAlgo = "",
		mailDomain = false,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-letsencrypt-domain",
			user,
			domain,
			aliasesCsv,
			mailDomain ? "yes" : "",
			keyAlgo,
		);
	}
	async deleteLetsEncryptDomain(
		user: string,
		domain: string,
		mailDomain = false,
	) {
		assertUsername(user);
		// The mail variant carries a trailing 'yes' (the mail flag).
		await this.runChecked(
			"v-delete-letsencrypt-domain",
			user,
			domain,
			"",
			...(mailDomain ? ["yes"] : []),
		);
	}
	async deleteWebDomainSsl(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-web-domain-ssl", user, domain, "no");
	}
	async setWebDomainSslForce(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-web-domain-ssl-force" : "v-delete-web-domain-ssl-force",
			user,
			domain,
		);
	}
	async setWebDomainSslHsts(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-web-domain-ssl-hsts" : "v-delete-web-domain-ssl-hsts",
			user,
			domain,
		);
	}
	async addFastcgiCache(user: string, domain: string, duration: string) {
		assertUsername(user);
		await this.runChecked("v-add-fastcgi-cache", user, domain, duration);
	}
	async deleteFastcgiCache(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-fastcgi-cache", user, domain);
	}
	/** The add/change/delete branch of edit/web's stats select. */
	async setWebDomainStats(
		user: string,
		domain: string,
		current: string,
		next: string,
	) {
		assertUsername(user);
		if (!next) {
			if (current) {
				await this.runChecked("v-delete-web-domain-stats", user, domain);
			}
		} else if (!current) {
			await this.runChecked("v-add-web-domain-stats", user, domain, next);
		} else {
			await this.runChecked("v-change-web-domain-stats", user, domain, next);
		}
	}
	async suspendWebDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-web-domain", user, domain);
	}
	async unsuspendWebDomain(user: string, domain: string) {
		assertUsername(user);
		// NB: the command really is v-unsuspend-domain (no "-web-").
		await this.runChecked("v-unsuspend-domain", user, domain);
	}
	async deleteWebDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-web-domain", user, domain, "yes");
	}
	async restartWeb() {
		await this.runChecked("v-restart-web");
	}
	async restartProxy() {
		await this.runChecked("v-restart-proxy");
	}

	/* ---- DNS domains + records ---- */

	async addDnsDomain(
		user: string,
		domain: string,
		ip: string,
		ns: string[],
		dnssec: boolean,
	): Promise<void> {
		assertUsername(user);
		const servers = [...ns.slice(0, 8)];
		while (servers.length < 8) servers.push("");
		await this.runChecked(
			"v-add-dns-domain",
			user,
			domain,
			ip,
			...servers,
			"no",
			dnssec ? "yes" : "no",
		);
	}
	async changeDnsDomainIp(user: string, domain: string, ip: string) {
		assertUsername(user);
		await this.runChecked("v-change-dns-domain-ip", user, domain, ip, "no");
	}
	async changeDnsDomainTpl(user: string, domain: string, tpl: string) {
		assertUsername(user);
		await this.runChecked("v-change-dns-domain-tpl", user, domain, tpl, "no");
	}
	async changeDnsDomainSoa(user: string, domain: string, soa: string) {
		assertUsername(user);
		await this.runChecked("v-change-dns-domain-soa", user, domain, soa, "no");
	}
	async changeDnsDomainExp(user: string, domain: string, exp: string) {
		assertUsername(user);
		await this.runChecked("v-change-dns-domain-exp", user, domain, exp, "no");
	}
	async changeDnsDomainTtl(user: string, domain: string, ttl: string) {
		assertUsername(user);
		await this.runChecked("v-change-dns-domain-ttl", user, domain, ttl, "no");
	}
	async setDnsDomainDnssec(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			"v-change-dns-domain-dnssec",
			user,
			domain,
			on ? "yes" : "no",
		);
	}
	async restartDns() {
		await this.runChecked("v-restart-dns");
	}
	async suspendDnsDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-dns-domain", user, domain);
	}
	async unsuspendDnsDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-dns-domain", user, domain);
	}
	async deleteDnsDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-dns-domain", user, domain);
	}
	async addDnsRecord(
		user: string,
		domain: string,
		rec: string,
		type: string,
		value: string,
		priority: string,
		ttl: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-dns-record",
			user,
			domain,
			rec,
			type,
			value,
			priority,
			"",
			"yes",
			ttl,
		);
	}
	async changeDnsRecord(
		user: string,
		domain: string,
		id: string,
		rec: string,
		type: string,
		value: string,
		priority: string,
		ttl: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-dns-record",
			user,
			domain,
			id,
			rec,
			type,
			value,
			priority,
			"yes",
			ttl,
		);
	}
	async changeDnsRecordId(
		user: string,
		domain: string,
		oldId: string,
		newId: string,
	) {
		assertUsername(user);
		await this.runChecked("v-change-dns-record-id", user, domain, oldId, newId);
	}
	async suspendDnsRecord(user: string, domain: string, id: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-dns-record", user, domain, id);
	}
	async unsuspendDnsRecord(user: string, domain: string, id: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-dns-record", user, domain, id);
	}
	async deleteDnsRecord(user: string, domain: string, id: string) {
		assertUsername(user);
		await this.runChecked("v-delete-dns-record", user, domain, id);
	}

	/* ---- Mail domains + accounts ---- */

	async addMailDomain(
		user: string,
		domain: string,
		opts: {
			antispam?: boolean;
			antivirus?: boolean;
			dkim?: boolean;
			dkimSelector?: string;
		} = {},
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-mail-domain",
			user,
			domain,
			opts.antispam ? "yes" : "no",
			opts.antivirus ? "yes" : "no",
			opts.dkim ? "yes" : "no",
			"2048",
			"",
			"",
			opts.dkimSelector ?? "mail",
		);
	}
	async setMailDomainAntispam(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-mail-domain-antispam" : "v-delete-mail-domain-antispam",
			user,
			domain,
		);
	}
	async setMailDomainAntivirus(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-mail-domain-antivirus" : "v-delete-mail-domain-antivirus",
			user,
			domain,
		);
	}
	async addMailDomainDkim(user: string, domain: string, selector: string) {
		assertUsername(user);
		await this.runChecked("v-add-mail-domain-dkim", user, domain, "", selector);
	}
	async deleteMailDomainDkim(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain-dkim", user, domain);
	}
	async setMailDomainReject(user: string, domain: string, on: boolean) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-mail-domain-reject" : "v-delete-mail-domain-reject",
			user,
			domain,
			"yes",
		);
	}
	async addMailDomainCatchall(user: string, domain: string, email: string) {
		assertUsername(user);
		await this.runChecked("v-add-mail-domain-catchall", user, domain, email);
	}
	async changeMailDomainCatchall(user: string, domain: string, email: string) {
		assertUsername(user);
		await this.runChecked(
			"v-change-mail-domain-catchall",
			user,
			domain,
			email,
		);
	}
	async deleteMailDomainCatchall(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain-catchall", user, domain);
	}
	async changeMailDomainRateLimit(user: string, domain: string, rate: string) {
		assertUsername(user);
		await this.runChecked(
			"v-change-mail-domain-rate-limit",
			user,
			domain,
			rate || "system",
		);
	}
	async suspendMailDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-mail-domain", user, domain);
	}
	async unsuspendMailDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-mail-domain", user, domain);
	}
	async deleteMailDomain(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain", user, domain);
	}
	async addMailAccount(
		user: string,
		domain: string,
		account: string,
		secret: string,
		quota: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (path) =>
			this.runChecked(
				"v-add-mail-account",
				user,
				domain,
				account,
				path,
				quota || "0",
			),
		);
	}
	async changeMailAccountPassword(
		user: string,
		domain: string,
		account: string,
		secret: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (path) =>
			this.runChecked(
				"v-change-mail-account-password",
				user,
				domain,
				account,
				path,
			),
		);
	}
	async changeMailAccountQuota(
		user: string,
		domain: string,
		account: string,
		quota: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-mail-account-quota",
			user,
			domain,
			account,
			quota || "0",
		);
	}
	async changeMailAccountRateLimit(
		user: string,
		domain: string,
		account: string,
		rate: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-mail-account-rate-limit",
			user,
			domain,
			account,
			rate || "system",
		);
	}
	async addMailAccountAlias(
		user: string,
		domain: string,
		account: string,
		alias: string,
	) {
		assertUsername(user);
		await this.runChecked("v-add-mail-account-alias", user, domain, account, alias);
	}
	async deleteMailAccountAlias(
		user: string,
		domain: string,
		account: string,
		alias: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-delete-mail-account-alias",
			user,
			domain,
			account,
			alias,
		);
	}
	async addMailAccountForward(
		user: string,
		domain: string,
		account: string,
		forward: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-mail-account-forward",
			user,
			domain,
			account,
			forward,
		);
	}
	async deleteMailAccountForward(
		user: string,
		domain: string,
		account: string,
		forward: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-delete-mail-account-forward",
			user,
			domain,
			account,
			forward,
		);
	}
	async setMailAccountFwdOnly(
		user: string,
		domain: string,
		account: string,
		on: boolean,
	) {
		assertUsername(user);
		await this.runChecked(
			on ? "v-add-mail-account-fwd-only" : "v-delete-mail-account-fwd-only",
			user,
			domain,
			account,
		);
	}
	async addMailAccountAutoreply(
		user: string,
		domain: string,
		account: string,
		message: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-mail-account-autoreply",
			user,
			domain,
			account,
			message,
		);
	}
	async deleteMailAccountAutoreply(user: string, domain: string, account: string) {
		assertUsername(user);
		await this.runChecked(
			"v-delete-mail-account-autoreply",
			user,
			domain,
			account,
		);
	}
	async suspendMailAccount(user: string, domain: string, account: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-mail-account", user, domain, account);
	}
	async unsuspendMailAccount(user: string, domain: string, account: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-mail-account", user, domain, account);
	}
	async deleteMailAccount(user: string, domain: string, account: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-account", user, domain, account);
	}

	/* ---- Databases ---- */

	async addDatabase(
		user: string,
		database: string,
		dbuser: string,
		secret: string,
		type: string,
		host: string,
		charset: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (path) =>
			this.runChecked(
				"v-add-database",
				user,
				database,
				dbuser,
				path,
				type,
				host,
				charset,
			),
		);
	}
	async changeDatabaseUser(user: string, database: string, dbuser: string) {
		assertUsername(user);
		await this.runChecked("v-change-database-user", user, database, dbuser);
	}
	async changeDatabasePassword(user: string, database: string, secret: string) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (path) =>
			this.runChecked("v-change-database-password", user, database, path),
		);
	}
	async suspendDatabase(user: string, database: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-database", user, database);
	}
	async unsuspendDatabase(user: string, database: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-database", user, database);
	}
	async deleteDatabase(user: string, database: string) {
		assertUsername(user);
		await this.runChecked("v-delete-database", user, database);
	}

	/* ---- Cron jobs ---- */

	async addCronJob(
		user: string,
		min: string,
		hour: string,
		day: string,
		month: string,
		wday: string,
		cmd: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-add-cron-job",
			user,
			min,
			hour,
			day,
			month,
			wday,
			cmd,
		);
	}
	async changeCronJob(
		user: string,
		job: string,
		min: string,
		hour: string,
		day: string,
		month: string,
		wday: string,
		cmd: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-cron-job",
			user,
			job,
			min,
			hour,
			day,
			month,
			wday,
			cmd,
		);
	}
	async suspendCronJob(user: string, job: string) {
		assertUsername(user);
		await this.runChecked("v-suspend-cron-job", user, job);
	}
	async unsuspendCronJob(user: string, job: string) {
		assertUsername(user);
		await this.runChecked("v-unsuspend-cron-job", user, job);
	}
	async deleteCronJob(user: string, job: string) {
		assertUsername(user);
		await this.runChecked("v-delete-cron-job", user, job);
	}

	/* ---- Phase 3 extras: cert staging, FTP, mail webmail/relay/SSL ---- */

	/**
	 * Stage a set of named files in a 0600-per-file temp directory under
	 * /tmp (the cert pattern from the Phase 0 audit: edit/web + edit/mail
	 * write <domain>.crt/.key/.ca into a mktemp dir for the SSL commands).
	 */
	async withStagedDir<T>(
		files: Record<string, string>,
		fn: (dir: string) => Promise<T>,
	): Promise<T> {
		if (!tmpdir().startsWith("/tmp")) {
			throw new Error("withStagedDir requires os.tmpdir() under /tmp");
		}
		const dir = await mkdtemp(join(tmpdir(), "hestiang-stage-"));
		try {
			for (const [name, contents] of Object.entries(files)) {
				await writeFile(join(dir, name), contents, { mode: 0o600 });
			}
			return await fn(dir);
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	}

	/** Cert contents as the PHP pages stage them: CRLF→LF + trailing LF. */
	private certFiles(
		domain: string,
		cert: { crt: string; key: string; ca?: string },
	): Record<string, string> {
		const norm = (s: string) => s.replace(/\r\n/g, "\n") + "\n";
		const files: Record<string, string> = {};
		if (cert.crt) files[`${domain}.crt`] = norm(cert.crt);
		if (cert.key) files[`${domain}.key`] = norm(cert.key);
		if (cert.ca) files[`${domain}.ca`] = norm(cert.ca);
		return files;
	}

	listWebDomainSsl(user: string, domain: string) {
		assertUsername(user);
		return this.listOne("v-list-web-domain-ssl", domain, user, domain);
	}
	listMailDomainSsl(user: string, domain: string) {
		assertUsername(user);
		return this.listOne("v-list-mail-domain-ssl", domain, user, domain);
	}
	async changeWebDomainSslcert(
		user: string,
		domain: string,
		cert: { crt: string; key: string; ca?: string },
	) {
		assertUsername(user);
		await this.withStagedDir(this.certFiles(domain, cert), (dir) =>
			this.runChecked("v-change-web-domain-sslcert", user, domain, dir, "no"),
		);
	}
	async addMailDomainSsl(
		user: string,
		domain: string,
		cert: { crt: string; key: string; ca?: string },
	) {
		assertUsername(user);
		await this.withStagedDir(this.certFiles(domain, cert), (dir) =>
			this.runChecked("v-add-mail-domain-ssl", user, domain, dir, "no"),
		);
	}
	async changeMailDomainSslcert(
		user: string,
		domain: string,
		cert: { crt: string; key: string; ca?: string },
	) {
		assertUsername(user);
		await this.withStagedDir(this.certFiles(domain, cert), (dir) =>
			this.runChecked("v-change-mail-domain-sslcert", user, domain, dir, "no"),
		);
	}
	async deleteMailDomainSsl(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain-ssl", user, domain);
	}
	async restartMail() {
		await this.runChecked("v-restart-mail");
	}

	/* FTP accounts. NB the PHP asymmetry: v-add-web-domain-ftp takes the
	 * username SUFFIX (the command prefixes <user>_ itself), while the
	 * change/delete commands take the FULL username. */
	async addWebDomainFtp(
		user: string,
		domain: string,
		ftpUserSuffix: string,
		secret: string,
		path: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (file) =>
			this.runChecked(
				"v-add-web-domain-ftp",
				user,
				domain,
				ftpUserSuffix,
				file,
				path,
			),
		);
	}
	async changeWebDomainFtpPassword(
		user: string,
		domain: string,
		ftpUserFull: string,
		secret: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (file) =>
			this.runChecked(
				"v-change-web-domain-ftp-password",
				user,
				domain,
				ftpUserFull,
				file,
			),
		);
	}
	async changeWebDomainFtpPath(
		user: string,
		domain: string,
		ftpUserFull: string,
		path: string,
	) {
		assertUsername(user);
		await this.runChecked(
			"v-change-web-domain-ftp-path",
			user,
			domain,
			ftpUserFull,
			path,
		);
	}
	async deleteWebDomainFtp(user: string, domain: string, ftpUserFull: string) {
		assertUsername(user);
		await this.runChecked("v-delete-web-domain-ftp", user, domain, ftpUserFull);
	}

	/* Mail domain webmail alias + SMTP relay. */
	async addMailDomainWebmail(user: string, domain: string, alias: string) {
		assertUsername(user);
		await this.runChecked("v-add-mail-domain-webmail", user, domain, alias, "yes");
	}
	async deleteMailDomainWebmail(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain-webmail", user, domain, "yes");
	}
	async addMailDomainSmtpRelay(
		user: string,
		domain: string,
		host: string,
		relayUser: string,
		secret: string,
		port: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (file) =>
			this.runChecked(
				"v-add-mail-domain-smtp-relay",
				user,
				domain,
				host,
				relayUser,
				file,
				port || "587",
			),
		);
	}
	async deleteMailDomainSmtpRelay(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-mail-domain-smtp-relay", user, domain);
	}

	/* ---- Phase 3 remainder: stats users, backups, firewall/IPs, server ---- */

	/* Web stats authorization: a single auth user per domain in 1.10.5.
	 * The same add command sets the user and (re)sets its password. */
	async addWebDomainStatsUser(
		user: string,
		domain: string,
		statsUser: string,
		secret: string,
	) {
		assertUsername(user);
		await this.withStagedFile(`${secret}\n`, (file) =>
			this.runChecked(
				"v-add-web-domain-stats-user",
				user,
				domain,
				statsUser,
				file,
			),
		);
	}
	async deleteWebDomainStatsUser(user: string, domain: string) {
		assertUsername(user);
		await this.runChecked("v-delete-web-domain-stats-user", user, domain);
	}

	/* Backups. */
	async listUserBackup(user: string, backup: string) {
		assertUsername(user);
		const rows = await this.listRows("v-list-user-backup", user, backup);
		return rows[backup];
	}
	async scheduleUserBackup(user: string) {
		assertUsername(user);
		await this.runChecked("v-schedule-user-backup", user);
	}
	/**
	 * Schedule a restore: full (no sections) or per-section, where each
	 * section is the object name to restore or "no" (cron takes yes/no),
	 * exactly as web/schedule/restore builds the command.
	 */
	async scheduleUserRestore(
		user: string,
		backup: string,
		sections?: {
			web: string;
			dns: string;
			mail: string;
			db: string;
			cron: string;
			udir: string;
		},
	) {
		assertUsername(user);
		if (!sections) {
			await this.runChecked("v-schedule-user-restore", user, backup);
		} else {
			await this.runChecked(
				"v-schedule-user-restore",
				user,
				backup,
				sections.web,
				sections.dns,
				sections.mail,
				sections.db,
				sections.cron,
				sections.udir,
			);
		}
	}
	async deleteUserBackup(user: string, backup: string) {
		assertUsername(user);
		await this.runChecked("v-delete-user-backup", user, backup);
	}
	async scheduleUserBackupDownload(user: string, backup: string) {
		assertUsername(user);
		await this.runChecked("v-schedule-user-backup-download", user, backup);
	}
	/** Exclusion lists as a flat {WEB: "a,b", DNS: "", ...} record. */
	async listUserBackupExclusions(
		user: string,
	): Promise<Record<string, string>> {
		assertUsername(user);
		const parsed = await this.json<Record<string, string>>(
			"v-list-user-backup-exclusions",
			user,
			"json",
		);
		return parsed;
	}
	/** Stage the five KEY='csv' lines, as web/edit/backup/exclusions does. */
	async updateUserBackupExclusions(
		user: string,
		exclusions: Record<string, string>,
	) {
		assertUsername(user);
		const body =
			["WEB", "DNS", "MAIL", "DB", "USER"]
				.map((k) => `${k}='${(exclusions[k] ?? "").replace(/'/g, "")}'`)
				.join("\n") + "\n";
		await this.withStagedFile(body, (file) =>
			this.runChecked("v-update-user-backup-exclusions", user, file),
		);
	}
	async deleteUserBackupExclusions(user: string, system: string) {
		assertUsername(user);
		await this.runChecked("v-delete-user-backup-exclusions", user, system);
	}

	/* Firewall (admin surface; the commands take no user argument). */
	async addFirewallRule(
		action: string,
		ip: string,
		port: string,
		protocol: string,
		comment: string,
	) {
		await this.runChecked(
			"v-add-firewall-rule",
			action,
			ip,
			port,
			protocol,
			comment,
		);
	}
	async changeFirewallRule(
		rule: string,
		action: string,
		ip: string,
		port: string,
		protocol: string,
		comment: string,
	) {
		await this.runChecked(
			"v-change-firewall-rule",
			rule,
			action,
			ip,
			port,
			protocol,
			comment,
		);
	}
	async deleteFirewallRule(rule: string) {
		await this.runChecked("v-delete-firewall-rule", rule);
	}
	async listFirewallRule(rule: string) {
		const rows = await this.listRows("v-list-firewall-rule", rule);
		return rows[rule];
	}
	async addFirewallBan(ip: string, chain: string) {
		await this.runChecked("v-add-firewall-ban", ip, chain);
	}
	async deleteFirewallBan(ip: string, chain: string) {
		await this.runChecked("v-delete-firewall-ban", ip, chain);
	}
	async addFirewallIpset(
		name: string,
		source: string,
		ipVersion: string,
		autoupdate: string,
	) {
		await this.runChecked(
			"v-add-firewall-ipset",
			name,
			source,
			ipVersion,
			autoupdate,
		);
	}
	async deleteFirewallIpset(name: string) {
		await this.runChecked("v-delete-firewall-ipset", name);
	}

	/* System IPs (admin). */
	async listSysIp(ip: string) {
		const rows = await this.listRows("v-list-sys-ip", ip);
		return rows[ip];
	}
	async addSysIp(
		ip: string,
		netmask: string,
		iface: string,
		owner: string,
		status: string,
		name: string,
		nat: string,
	) {
		await this.runChecked(
			"v-add-sys-ip",
			ip,
			netmask,
			iface,
			owner,
			status,
			name,
			nat,
		);
	}
	async changeSysIpStatus(ip: string, status: string) {
		await this.runChecked("v-change-sys-ip-status", ip, status);
	}
	async changeSysIpOwner(ip: string, owner: string) {
		await this.runChecked("v-change-sys-ip-owner", ip, owner);
	}
	async changeSysIpName(ip: string, name: string) {
		await this.runChecked("v-change-sys-ip-name", ip, name);
	}
	async changeSysIpNat(ip: string, nat: string) {
		await this.runChecked("v-change-sys-ip-nat", ip, nat);
	}
	async deleteSysIp(ip: string) {
		await this.runChecked("v-delete-sys-ip", ip);
	}

	/* System feature toggles (edit/server): each is an add/delete pair. */
	async addSysFirewall() {
		await this.runChecked("v-add-sys-firewall");
	}
	async deleteSysFirewall() {
		await this.runChecked("v-delete-sys-firewall");
	}
	async addSysFilemanager() {
		await this.runChecked("v-add-sys-filemanager");
	}
	async deleteSysFilemanager() {
		await this.runChecked("v-delete-sys-filemanager");
	}
	async addSysWebTerminal() {
		await this.runChecked("v-add-sys-web-terminal");
	}
	async deleteSysWebTerminal() {
		await this.runChecked("v-delete-sys-web-terminal");
	}
	async addSysQuota() {
		await this.runChecked("v-add-sys-quota");
	}
	async deleteSysQuota() {
		await this.runChecked("v-delete-sys-quota");
	}

	/* Server settings (admin). */
	async changeSysHostname(hostname: string) {
		await this.runChecked("v-change-sys-hostname", hostname);
	}
	async changeSysTimezone(timezone: string) {
		await this.runChecked("v-change-sys-timezone", timezone);
	}
	async changeSysLanguage(language: string, updateUsers = false) {
		await this.runChecked(
			"v-change-sys-language",
			language,
			...(updateUsers ? ["yes"] : []),
		);
	}
	async changeSysConfigValue(key: string, value: string) {
		await this.runChecked("v-change-sys-config-value", key, value);
	}
	async getSysTimezones(): Promise<string[]> {
		const result = await this.raw("v-get-sys-timezones");
		return result.stdout.split("\n").map((s) => s.trim()).filter(Boolean);
	}
	/** Read a service config file through the engine (plain text). */
	async openFsConfig(path: string): Promise<string> {
		const result = await this.raw("v-open-fs-config", path);
		if (result.code !== 0) {
			throw new Error(
				`v-open-fs-config exited ${result.code}: ${result.stderr.trim() || result.stdout.trim()}`,
			);
		}
		return result.stdout;
	}
	/**
	 * Save a service config: stage the contents and hand the file to
	 * v-change-sys-service-config — the archetype behind all ~22
	 * web/edit/server/<service> pages.
	 */
	async changeSysServiceConfig(
		service: string,
		contents: string,
		restart: boolean,
	) {
		await this.withStagedFile(contents, (file) =>
			this.runChecked(
				"v-change-sys-service-config",
				file,
				service,
				restart ? "yes" : "no",
			),
		);
	}
	async startService(service: string) {
		await this.runChecked("v-start-service", service);
	}
	async stopService(service: string) {
		await this.runChecked("v-stop-service", service);
	}
	async restartService(service: string) {
		await this.runChecked("v-restart-service", service, "yes");
	}
	async listBackupHosts() {
		return this.listRows("v-list-backup-host");
	}
	async addBackupHost(
		type: string,
		host: string,
		username: string,
		secret: string,
		path: string,
		port: string,
	) {
		await this.withStagedFile(`${secret}\n`, (file) =>
			this.runChecked(
				"v-add-backup-host",
				type,
				host,
				username,
				file,
				path,
				port,
			),
		);
	}
	async deleteBackupHost(type: string) {
		await this.runChecked("v-delete-backup-host", type);
	}
	async addBackupHostRestic(
		repo: string,
		snapshots: string,
		keepDaily: string,
		keepWeekly: string,
		keepMonthly: string,
		keepYearly: string,
	) {
		await this.runChecked(
			"v-add-backup-host-restic",
			repo,
			snapshots,
			keepDaily,
			keepWeekly,
			keepMonthly,
			keepYearly,
		);
	}
	async deleteBackupHostRestic() {
		await this.runChecked("v-delete-backup-host-restic");
	}

	/* ---- Phase 4: search + restic (incremental) backups ---- */

	/** Global object search (admin): v-search-object. */
	async searchObjects(query: string): Promise<HestiaRow[]> {
		return this.json<HestiaRow[]>("v-search-object", query, "json");
	}
	/** Per-user object search: v-search-user-object. */
	async searchUserObjects(user: string, query: string): Promise<HestiaRow[]> {
		assertUsername(user);
		return this.json<HestiaRow[]>("v-search-user-object", user, query, "json");
	}
	/** Restic snapshots for a user (a JSON array, newest last upstream). */
	async listUserBackupsRestic(user: string): Promise<HestiaRow[]> {
		assertUsername(user);
		const data = await this.json<unknown>(
			"v-list-user-backups-restic",
			user,
			"json",
		);
		return Array.isArray(data) ? (data as HestiaRow[]) : [];
	}
	async listUserBackupRestic(user: string, snapshot: string) {
		assertUsername(user);
		const rows = await this.listRows(
			"v-list-user-backup-restic",
			user,
			snapshot,
		);
		return rows[snapshot];
	}
	async scheduleUserBackupRestic(user: string) {
		assertUsername(user);
		await this.runChecked("v-schedule-user-backup-restic", user);
	}
	/**
	 * Schedule a restic restore: full snapshot, or one typed object
	 * (web/schedule/restore/incremental's two shapes).
	 */
	async scheduleUserRestoreRestic(
		user: string,
		snapshot: string,
		type?: string,
		object?: string,
	) {
		assertUsername(user);
		if (type && object) {
			await this.runChecked(
				"v-schedule-user-restore-restic",
				user,
				snapshot,
				type,
				object,
			);
		} else if (type) {
			// e.g. cron restores pass the type with no object argument
			await this.runChecked("v-schedule-user-restore-restic", user, snapshot, type);
		} else {
			await this.runChecked("v-schedule-user-restore-restic", user, snapshot);
		}
	}
	async deleteUserBackupRestic(user: string, snapshot: string) {
		assertUsername(user);
		await this.runChecked("v-delete-user-backup-restic", user, snapshot);
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

	// ---- Two-factor authentication ----

	/**
	 * Verify a TOTP code via v-check-user-2fa. The TOTP secret never leaves
	 * the bash layer (it lives in user.conf; the command shells to Hestia's
	 * own 2fa checker), so the lib needs no TOTP implementation of its own.
	 */
	async checkUser2fa(user: string, code: string): Promise<boolean> {
		assertUsername(user);
		const result = await this.raw("v-check-user-2fa", user, code);
		return result.code === 0;
	}

	/** Enable 2FA: v-add-user-2fa generates and stores the secret server-side. */
	async addUser2fa(user: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-add-user-2fa", user);
	}

	async deleteUser2fa(user: string): Promise<void> {
		assertUsername(user);
		await this.runChecked("v-delete-user-2fa", user);
	}

	// ---- Audit logging (best-effort: logging must never break the action) ----

	/** v-log-action USER TYPE CATEGORY MESSAGE (the panel's history log). */
	async logAction(
		user: string,
		type: "Info" | "Warning" | "Error",
		category: string,
		message: string,
	): Promise<void> {
		try {
			await this.raw("v-log-action", user, type, category, message);
		} catch {
			// best-effort by design
		}
	}

	/** v-log-user-login — login attempts, success and failure. */
	async logUserLogin(
		user: string,
		ip: string,
		result: "success" | "failed",
		sessionId: string,
		userAgent: string,
		reason?: string,
	): Promise<void> {
		try {
			const args = [user, ip, result, sessionId, userAgent];
			if (reason) args.push("yes", reason);
			await this.raw("v-log-user-login", ...args);
		} catch {
			// best-effort by design
		}
	}

	/** v-log-user-logout — recorded when a session ends or is killed. */
	async logUserLogout(user: string, sessionId: string): Promise<void> {
		try {
			await this.raw("v-log-user-logout", user, sessionId);
		} catch {
			// best-effort by design
		}
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
