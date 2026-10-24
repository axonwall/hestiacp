"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	errorMessage,
	hestia,
	requireAdmin,
} from "@/lib/panel";

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

export async function deleteFirewallRuleAction(
	formData: FormData,
): Promise<void> {
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

export async function deleteFirewallBanAction(
	formData: FormData,
): Promise<void> {
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

export async function addFirewallIpsetAction(
	formData: FormData,
): Promise<void> {
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

export async function deleteFirewallIpsetAction(
	formData: FormData,
): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/firewall?error=csrf");
	try {
		await hestia.deleteFirewallIpset(String(formData.get("name") ?? ""));
	} catch (error) {
		redirect(`/list/firewall?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/firewall?saved=1");
}
