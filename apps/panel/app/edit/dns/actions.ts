"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Edit a DNS zone (web/edit/dns), changed-only; restarts DNS when
 *  anything actually changed, as the PHP page does. */
export async function editDnsDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/dns?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	let changed = false;
	try {
		const current = await hestia.listDnsDomain(user, domain);
		const ip = String(formData.get("ip") ?? "");
		if (ip && ip !== current.IP) {
			await hestia.changeDnsDomainIp(user, domain, ip);
			changed = true;
		}
		const tpl = String(formData.get("template") ?? "");
		if (tpl && tpl !== current.TPL) {
			await hestia.changeDnsDomainTpl(user, domain, tpl);
			changed = true;
		}
		const soa = String(formData.get("soa") ?? "").trim();
		if (soa && soa !== current.SOA) {
			await hestia.changeDnsDomainSoa(user, domain, soa);
			changed = true;
		}
		const exp = String(formData.get("exp") ?? "");
		if (exp && exp !== current.EXP) {
			await hestia.changeDnsDomainExp(user, domain, exp);
			changed = true;
		}
		const ttl = String(formData.get("ttl") ?? "").trim();
		if (ttl && ttl !== current.TTL) {
			await hestia.changeDnsDomainTtl(user, domain, ttl);
			changed = true;
		}
		const dnssec = formData.get("dnssec") === "yes";
		if (dnssec !== (current.DNSSEC === "yes")) {
			await hestia.setDnsDomainDnssec(user, domain, dnssec);
			changed = true;
		}
		if (changed) await hestia.restartDns();
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}

/** Suspend/unsuspend one record from the zone page. */
export async function toggleDnsRecordAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/dns?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData)) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const id = String(formData.get("id") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendDnsRecord(user, domain, id);
		} else {
			await hestia.unsuspendDnsRecord(user, domain, id);
		}
		await hestia.restartDns();
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
