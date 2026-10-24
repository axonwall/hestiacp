"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	errorMessage,
	hestia,
	requireAdmin,
} from "@/lib/panel";

/**
 * Basic server settings (web/edit/server, the fields with dedicated
 * commands or plain config values): changed-only, like everywhere.
 */
export async function editServerSettingsAction(
	formData: FormData,
): Promise<void> {
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
export async function editServerFeaturesAction(
	formData: FormData,
): Promise<void> {
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

export async function deleteBackupHostAction(
	formData: FormData,
): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/edit/server?error=csrf");
	try {
		await hestia.deleteBackupHost(String(formData.get("type") ?? ""));
	} catch (error) {
		redirect(`/edit/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/edit/server?saved=1");
}

export async function saveBackupHostResticAction(
	formData: FormData,
): Promise<void> {
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

/** Save a service config file (the web/edit/server/<service> archetype). */
export async function saveServiceConfigAction(
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
