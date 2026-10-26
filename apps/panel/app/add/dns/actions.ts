"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

function back(path: string, error?: string): never {
	redirect(error ? `${path}?error=${encodeURIComponent(error)}` : path);
}

/** Create a DNS zone (web/add/dns): add, then template / expiration /
 *  TTL follow-ups when they differ from the defaults, then restart. */
export async function addDnsDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/dns?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "")
		.trim()
		.toLowerCase();
	const ip = String(formData.get("ip") ?? "");
	const ns = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => String(formData.get(`ns${i}`) ?? "").trim());
	if (!domain || !ip) redirect("/add/dns?error=missing");
	try {
		await hestia.addDnsDomain(user, domain, ip, ns, formData.get("dnssec") === "yes");
		const tpl = String(formData.get("template") ?? "");
		if (tpl && tpl !== "default") {
			await hestia.changeDnsDomainTpl(user, domain, tpl);
		}
		const exp = String(formData.get("exp") ?? "");
		if (exp) await hestia.changeDnsDomainExp(user, domain, exp);
		const ttl = String(formData.get("ttl") ?? "");
		if (ttl && ttl !== "14400") {
			await hestia.changeDnsDomainTtl(user, domain, ttl);
		}
		await hestia.restartDns();
	} catch (error) {
		back("/add/dns", errorMessage(error));
	}
	redirect(`/edit/dns?domain=${encodeURIComponent(domain)}&saved=1`);
}

/** Add a DNS record (the second form on web/add/dns). */
export async function addDnsRecordAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const backPath = String(formData.get("back") ?? "/add/dns");
	if (!csrfValid(session, formData)) redirect(`${backPath}?error=csrf`);
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	const rec = String(formData.get("rec") ?? "").trim();
	const type = String(formData.get("type") ?? "A");
	const value = String(formData.get("value") ?? "").trim();
	if (!domain || !value) redirect(`${backPath}?error=missing`);
	try {
		await hestia.addDnsRecord(
			user,
			domain,
			rec,
			type,
			value,
			String(formData.get("priority") ?? "").trim(),
			String(formData.get("ttl") ?? "").trim(),
		);
		await hestia.restartDns();
	} catch (error) {
		back(backPath, errorMessage(error));
	}
	redirect(`${backPath}?saved=1`);
}
