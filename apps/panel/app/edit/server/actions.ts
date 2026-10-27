"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

/**
 * Basic server settings (web/edit/server, the fields with dedicated
 * commands or plain config values): changed-only, like everywhere.
 */
export async function editServerSettingsAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		const text = (name: string) => String(formData.get(name) ?? "").trim();
		if (text("hostname") && text("hostname") !== sys.HOSTNAME) {
			await hestia.changeSysHostname(text("hostname"));
		}
		if (text("timezone") && text("timezone") !== sys.TIMEZONE) {
			await hestia.changeSysTimezone(text("timezone"));
		}
		if (text("language") && text("language") !== sys.LANGUAGE) {
			await hestia.changeSysLanguage(
				text("language"),
				formData.get("languageUpdateUsers") === "yes",
			);
		}
		const configValues: Array<[string, string]> = [
			["THEME", text("theme")],
			["RELEASE_BRANCH", text("releaseBranch")],
			["BACKUP_MODE", text("backupMode")],
			["BACKUP_GZIP", text("backupGzip")],
			["BACKUP", text("backupDir")],
			["DEBUG_MODE", formData.get("debugMode") === "yes" ? "yes" : ""],
		];
		for (const [key, value] of configValues) {
			if (value !== (sys[key] ?? "")) {
				await hestia.changeSysConfigValue(key, value);
			}
		}
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

/**
 * Feature toggles whose state lives in sys config and whose changes
 * are add/delete command pairs (firewall, file manager, web terminal,
 * disk quota).
 */
export async function editServerFeaturesAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		const toggles: Array<{
			field: string;
			on: boolean;
			add: () => Promise<void>;
			remove: () => Promise<void>;
		}> = [
			{
				field: "firewall",
				on: !!sys.FIREWALL_SYSTEM,
				add: () => hestia.addSysFirewall(),
				remove: () => hestia.deleteSysFirewall(),
			},
			{
				field: "fileManager",
				on: sys.FILE_MANAGER === "true",
				add: () => hestia.addSysFilemanager(),
				remove: () => hestia.deleteSysFilemanager(),
			},
			{
				field: "webTerminal",
				on: sys.WEB_TERMINAL === "true",
				add: () => hestia.addSysWebTerminal(),
				remove: () => hestia.deleteSysWebTerminal(),
			},
			{
				field: "quota",
				on: !!sys.QUOTA_SYSTEM,
				add: () => hestia.addSysQuota(),
				remove: () => hestia.deleteSysQuota(),
			},
		];
		for (const toggle of toggles) {
			const want = formData.get(toggle.field) === "yes";
			if (want && !toggle.on) await toggle.add();
			if (!want && toggle.on) await toggle.remove();
		}
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

export async function addBackupHostAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		await hestia.addBackupHost(
			String(formData.get("type") ?? ""),
			String(formData.get("host") ?? "").trim(),
			String(formData.get("username") ?? "").trim(),
			String(formData.get("secret") ?? ""),
			String(formData.get("path") ?? "").trim(),
			String(formData.get("port") ?? "").trim(),
		);
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

export async function deleteBackupHostAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		await hestia.deleteBackupHost(String(formData.get("type") ?? ""));
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

export async function saveBackupHostResticAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		if (formData.get("remove") === "yes") {
			await hestia.deleteBackupHostRestic();
		} else {
			const num = (name: string, fallback: string) =>
				String(formData.get(name) ?? "").trim() || fallback;
			await hestia.addBackupHostRestic(
				String(formData.get("repo") ?? "").trim(),
				num("snapshots", "10"),
				num("keepDaily", "7"),
				num("keepWeekly", "4"),
				num("keepMonthly", "6"),
				num("keepYearly", "2"),
			);
		}
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

/** Save a service config file (the web/edit/server/<service> archetype). */ export async function saveServiceConfigAction(
	formData: FormData,
): Promise<void> {
	const session = await requireAdmin();
	const service = String(formData.get("service") ?? "");
	const back = `/edit/server/service?service=${encodeURIComponent(service)}`;
	if (!csrfValid(session, formData) || !service) {
		redirect("/list/server?error=csrf");
	}
	try {
		await hestia.changeSysServiceConfig(
			service,
			String(formData.get("contents") ?? ""),
			formData.get("restart") === "yes",
		);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}

async function setConfigValue(
	sys: Record<string, string>,
	key: string,
	value: string,
): Promise<void> {
	if (value !== (sys[key] ?? "")) {
		await hestia.changeSysConfigValue(key, value);
	}
}

/**
 * Security section (web/edit/server): login style, session
 * timeout, CSRF strictness, subdomain ownership, preview
 * features (POLICY_SYSTEM_ENABLE_BACON), Quick App Installer,
 * resources limit (cgroups add/delete), phpMyAdmin SSO +
 * restrict (add/delete quiet pairs), and the two upgrade-email
 * toggles ("on" -> "true", else "false", as PHP normalizes).
 */
export async function editServerSecurityAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	// Validation redirects must stay OUTSIDE the try block: redirect()
	// throws, and a catch would swallow it into a NEXT_REDIRECT error.
	const text = (name: string) => String(formData.get(name) ?? "").trim();
	const sysPre = await hestia
		.listSysConfig()
		.then((r) => r.config ?? {})
		.catch(() => ({}) as Record<string, string>);
	const timeoutPre = text("inactiveTimeout");
	if (
		timeoutPre !== (sysPre.INACTIVE_SESSION_TIMEOUT ?? "") &&
		(timeoutPre === "" || Number(timeoutPre) < 1)
	) {
		redirect(
			"/edit/server?error=Inactive%20session%20timeout%20can%20not%20lower%20than%201%20minute.",
		);
	}
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		await setConfigValue(sys, "LOGIN_STYLE", text("loginStyle"));
		const timeout = text("inactiveTimeout");
		if (timeout !== (sys.INACTIVE_SESSION_TIMEOUT ?? "")) {
			await hestia.changeSysConfigValue("INACTIVE_SESSION_TIMEOUT", timeout);
		}
		await setConfigValue(sys, "POLICY_CSRF_STRICTNESS", text("csrfStrictness"));
		await setConfigValue(sys, "ENFORCE_SUBDOMAIN_OWNERSHIP", text("enforceSubdomain"));
		await setConfigValue(
			sys,
			"POLICY_SYSTEM_ENABLE_BACON",
			formData.get("experimental") === "on" ? "true" : "false",
		);
		await setConfigValue(sys, "PLUGIN_APP_INSTALLER", text("pluginInstaller"));
		const resources = text("resourcesLimit");
		if (resources !== (sys.RESOURCES_LIMIT ?? "")) {
			if (resources === "yes") await hestia.addSysCgroups();
			else await hestia.deleteSysCgroups();
		}
		const pmaKey = text("pmaKey");
		if (pmaKey === "yes" && (sys.PHPMYADMIN_KEY ?? "") === "") {
			await hestia.addSysPmaSso();
		} else if (pmaKey === "no" && (sys.PHPMYADMIN_KEY ?? "") !== "") {
			await hestia.deleteSysPmaSso();
		}
		const pmaRestrict = text("pmaRestrict");
		if (pmaRestrict === "yes" && sys.PMA_RESTRICT_ACCESS !== "yes") {
			await hestia.addSysPmaRestrict();
		} else if (pmaRestrict === "no" && sys.PMA_RESTRICT_ACCESS === "yes") {
			await hestia.deleteSysPmaRestrict();
		}
		await setConfigValue(
			sys,
			"UPGRADE_SEND_EMAIL",
			formData.get("upgradeNotify") === "on" ? "true" : "false",
		);
		await setConfigValue(
			sys,
			"UPGRADE_SEND_EMAIL_LOG",
			formData.get("upgradeLog") === "on" ? "true" : "false",
		);
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

/**
 * System Protection (PHP's root-only details): the three
 * policies that hide the admin account and server settings
 * from other administrators. The page renders this section
 * only for ROOT_USER; the action re-checks.
 */
export async function editServerProtectionAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	// Root check outside try: redirect() inside try would be caught.
	const sysPre = await hestia
		.listSysConfig()
		.then((r) => r.config ?? {})
		.catch(() => ({}) as Record<string, string>);
	const rootUser = String(session.data.ROOT_USER ?? sysPre.ROOT_USER ?? "");
	if (!rootUser || session.data.user !== rootUser) {
		redirect(
			"/edit/server?error=Only%20the%20root%20administrator%20may%20change%20these%20settings.",
		);
	}
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		const text = (name: string) => String(formData.get(name) ?? "").trim();
		await setConfigValue(sys, "POLICY_SYSTEM_PROTECTED_ADMIN", text("protectedAdmin"));
		await setConfigValue(sys, "POLICY_SYSTEM_HIDE_ADMIN", text("hideAdmin"));
		await setConfigValue(sys, "POLICY_SYSTEM_HIDE_SERVICES", text("hideServices"));
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

/**
 * User policies (PHP's Policies details): yes/no selects.
 * POLICY_USER_VIEW_SUSPENDED keeps PHP's gate: it is written
 * only when the posted value differs from the stored bacon
 * flag and preview features are currently off. PHP gates on
 * the same-POST experimental value; these are separate forms
 * here, so the current stored flag is used instead.
 * POLICY_USER_CHANGE_THEME is inverted, as PHP's checkbox is:
 * checked ("on") means users may NOT change the theme ("no").
 */
export async function editServerPoliciesAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		const text = (name: string) => String(formData.get(name) ?? "").trim();
		const pairs: Array<[string, string]> = [
			["POLICY_USER_EDIT_DETAILS", text("editDetails")],
			["POLICY_USER_EDIT_WEB_TEMPLATES", text("editWebTemplates")],
			["POLICY_USER_EDIT_DNS_TEMPLATES", text("editDnsTemplates")],
			["POLICY_USER_VIEW_LOGS", text("viewLogs")],
			["POLICY_USER_DELETE_LOGS", text("deleteLogs")],
			["POLICY_USER_BACKUP_SUSPENDED_USERS", text("backupSuspended")],
			["POLICY_SYNC_ERROR_DOCUMENTS", text("syncErrorDocuments")],
			["POLICY_SYNC_SKELETON", text("syncSkeleton")],
		];
		for (const [key, value] of pairs) {
			await setConfigValue(sys, key, value);
		}
		const viewSuspended = text("viewSuspended");
		if (
			viewSuspended !== (sys.POLICY_SYSTEM_ENABLE_BACON ?? "") &&
			(sys.POLICY_SYSTEM_ENABLE_BACON ?? "") !== "true"
		) {
			await setConfigValue(sys, "POLICY_USER_VIEW_SUSPENDED", viewSuspended);
		}
		await setConfigValue(
			sys,
			"POLICY_USER_CHANGE_THEME",
			formData.get("changeTheme") === "on" ? "no" : "yes",
		);
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

/**
 * API access (PHP's Security details): the 0/1/2 system level,
 * the legacy yes/no flag, and the allowed-IP list (one per
 * line in the form, comma-joined in config, keeping only
 * valid IPs and the literal "allow-all"). Any change runs
 * v-change-sys-api 'enable' first: PHP's disable branch
 * compares a POST string with === 0, which is never true,
 * so enable-on-change is the effective behavior.
 */
export async function editServerApiAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		const sys = (await hestia.listSysConfig()).config ?? {};
		const text = (name: string) => String(formData.get(name) ?? "").trim();
		const apiSystem = text("apiSystem");
		const legacyApi = text("legacyApi");
		const { isIP } = await import("node:net");
		const ips = text("allowedIps")
			.split("\n")
			.map((line) => line.trim())
			.filter((line) => line === "allow-all" || isIP(line) !== 0);
		const allowedIp = ips.join(",");
		const changed =
			apiSystem !== (sys.API_SYSTEM ?? "") ||
			legacyApi !== (sys.API ?? "") ||
			allowedIp !== (sys.API_ALLOWED_IP ?? "");
		if (changed) {
			await hestia.changeSysApi("enable");
			await setConfigValue(sys, "API_SYSTEM", apiSystem);
			await setConfigValue(sys, "API", legacyApi);
			await setConfigValue(sys, "API_ALLOWED_IP", allowedIp);
		}
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}
