"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

export async function addSysIpAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/add/ip?error=csrf");
	try {
		await hestia.addSysIp(
			String(formData.get("ip") ?? "").trim(),
			String(formData.get("netmask") ?? "").trim(),
			String(formData.get("iface") ?? "").trim(),
			String(formData.get("owner") ?? ""),
			formData.get("shared") === "yes" ? "shared" : "dedicated",
			String(formData.get("name") ?? "").trim(),
			String(formData.get("nat") ?? "").trim(),
		);
	} catch (error) {
		redirect(`/add/ip?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/ip?saved=1");
}

export async function editSysIpAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const ip = String(formData.get("ip") ?? "");
	const back = `/edit/ip?ip=${encodeURIComponent(ip)}`;
	if (!csrfValid(session, formData) || !ip) redirect("/list/ip?error=csrf");
	const current = await hestia.listSysIp(ip).catch(() => undefined);
	if (!current) redirect("/list/ip?error=missing");
	try {
		const status = formData.get("shared") === "yes" ? "shared" : "dedicated";
		if (status !== current.STATUS) {
			await hestia.changeSysIpStatus(ip, status);
		}
		const owner = String(formData.get("owner") ?? "");
		if (owner !== (current.OWNER ?? "")) {
			await hestia.changeSysIpOwner(ip, owner);
		}
		const name = String(formData.get("name") ?? "").trim();
		if (name !== (current.NAME ?? "")) {
			await hestia.changeSysIpName(ip, name);
		}
		const nat = String(formData.get("nat") ?? "").trim();
		if (nat !== (current.NAT ?? "")) {
			await hestia.changeSysIpNat(ip, nat);
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/ip?saved=1");
}

export async function deleteSysIpAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const ip = String(formData.get("ip") ?? "");
	const back = `/delete/ip?ip=${encodeURIComponent(ip)}`;
	if (!csrfValid(session, formData) || !ip) redirect("/list/ip?error=csrf");
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	try {
		await hestia.deleteSysIp(ip);
	} catch (error) {
		redirect(`/list/ip?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/ip?saved=1");
}

/** Bulk sys-IP action (PHP /bulk/ip/): "reread IP" (once) + Delete. */
export async function bulkIpAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/ip?error=csrf");
	const ips = formData.getAll("ip[]").map(String).filter(Boolean);
	const action = String(formData.get("action") ?? "");
	try {
		if (action === "reread") await hestia.updateSysIp();
		else if (action === "delete") {
			for (const ip of ips) await hestia.deleteSysIp(ip);
		}
	} catch (error) {
		redirect(`/list/ip?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/ip?saved=1");
}
