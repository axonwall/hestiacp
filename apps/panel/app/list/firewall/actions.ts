"use server";

import { redirect } from "next/navigation";
import { csrfValid, errorMessage, hestia, requireAdmin } from "@/lib/panel";

const normPort = (raw: string) =>
	raw.replace(/\s+/g, ",").replace(/,+/g, ",").replace(/^,|,$/g, "");

export async function addFirewallRuleAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/add/firewall?error=csrf");
	try {
		await hestia.addFirewallRule(
			String(formData.get("action") ?? ""),
			String(formData.get("ip") ?? "").trim(),
			normPort(String(formData.get("port") ?? "")),
			String(formData.get("protocol") ?? ""),
			String(formData.get("comment") ?? "").trim(),
		);
	} catch (error) {
		redirect(`/add/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function editFirewallRuleAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const rule = String(formData.get("rule") ?? "");
	const back = `/edit/firewall?rule=${encodeURIComponent(rule)}`;
	if (!csrfValid(session, formData) || !rule) redirect("/list/firewall?error=csrf");
	try {
		await hestia.changeFirewallRule(
			rule,
			String(formData.get("action") ?? ""),
			String(formData.get("ip") ?? "").trim(),
			normPort(String(formData.get("port") ?? "")),
			String(formData.get("protocol") ?? ""),
			String(formData.get("comment") ?? "").trim(),
		);
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function deleteFirewallRuleAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	const rule = String(formData.get("rule") ?? "");
	const back = `/delete/firewall?rule=${encodeURIComponent(rule)}`;
	if (!csrfValid(session, formData) || !rule) redirect("/list/firewall?error=csrf");
	if (formData.get("confirm") !== "yes") redirect(`${back}&error=confirm`);
	try {
		await hestia.deleteFirewallRule(rule);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function addFirewallBanAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	try {
		await hestia.addFirewallBan(
			String(formData.get("ip") ?? "").trim(),
			String(formData.get("chain") ?? "INPUT"),
		);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function deleteFirewallBanAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	try {
		await hestia.deleteFirewallBan(
			String(formData.get("ip") ?? ""),
			String(formData.get("chain") ?? "INPUT"),
		);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function addFirewallIpsetAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	try {
		await hestia.addFirewallIpset(
			String(formData.get("name") ?? "").trim(),
			String(formData.get("source") ?? "").trim(),
			String(formData.get("ipver") ?? "v4"),
			formData.get("autoupdate") === "yes" ? "yes" : "no",
		);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

export async function deleteFirewallIpsetAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	try {
		await hestia.deleteFirewallIpset(String(formData.get("name") ?? ""));
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

/** Suspend/unsuspend a firewall rule from the list. */
export async function toggleFirewallRuleAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	const rule = String(formData.get("rule") ?? "");
	try {
		if (formData.get("op") === "suspend") await hestia.suspendFirewallRule(rule);
		else await hestia.unsuspendFirewallRule(rule);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

/** Move a firewall rule up or down (PHP /move/firewall/). */
export async function moveFirewallRuleAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	const rule = String(formData.get("rule") ?? "");
	const direction = String(formData.get("direction") ?? "");
	try {
		await hestia.moveFirewallRule(rule, direction);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

/** Bulk firewall action (PHP /bulk/firewall/): delete only. */
export async function bulkFirewallAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	const rules = formData.getAll("rule[]").map(String).filter(Boolean);
	try {
		for (const rule of rules) await hestia.deleteFirewallRule(rule);
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}

/** Bulk firewall-ban action (PHP /bulk/firewall/banlist/): delete.
 * The checkbox carries the IP; the chain is resolved from the
 * current ban list, as PHP's ipchain[] value (ip:chain) does. */
export async function bulkFirewallBanAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall/banlist?error=csrf");
	const ips = formData.getAll("ipchain[]").map(String).filter(Boolean);
	try {
		const bans = await hestia.listFirewallBan();
		for (const ip of ips) {
			const row = bans[ip];
			if (row) await hestia.deleteFirewallBan(ip, row.CHAIN ?? "INPUT");
		}
	} catch (error) {
		redirect(`/list/firewall/banlist?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall/banlist?saved=1");
}

/** Bulk firewall-ipset action (PHP /bulk/firewall/ipset/): delete only. */
export async function bulkFirewallIpsetAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall/ipset?error=csrf");
	const names = formData.getAll("setname[]").map(String).filter(Boolean);
	try {
		for (const name of names) await hestia.deleteFirewallIpset(name);
	} catch (error) {
		redirect(`/list/firewall/ipset?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall/ipset?saved=1");
}
