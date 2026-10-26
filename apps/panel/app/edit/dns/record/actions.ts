"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Edit one DNS record (web/edit/dns record form): field changes via
 *  v-change-dns-record, an ID change via v-change-dns-record-id, then
 *  a DNS restart if anything moved. */
export async function editDnsRecordAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const id = String(formData.get("id") ?? "");
	const back = `/edit/dns/record?domain=${encodeURIComponent(domain)}&id=${encodeURIComponent(id)}`;
	if (!csrfValid(session, formData) || !domain || !id) {
		redirect(`${back}&error=csrf`);
	}
	const user = effectiveUser(session);
	let changed = false;
	try {
		const records = await hestia.listDnsRecords(user, domain);
		const current = records[id];
		if (!current) redirect(`${back}&error=notfound`);
		const rec = String(formData.get("rec") ?? "").trim();
		const type = String(formData.get("type") ?? "A");
		const value = String(formData.get("value") ?? "").trim();
		const priority = String(formData.get("priority") ?? "").trim();
		const ttl = String(formData.get("ttl") ?? "").trim();
		if (
			rec !== current.RECORD ||
			type !== current.TYPE ||
			value !== current.VALUE ||
			priority !== (current.PRIORITY ?? "") ||
			ttl !== (current.TTL ?? "")
		) {
			await hestia.changeDnsRecord(user, domain, id, rec, type, value, priority, ttl);
			changed = true;
		}
		const newId = String(formData.get("newId") ?? "").trim();
		if (newId && newId !== id) {
			await hestia.changeDnsRecordId(user, domain, id, newId);
			changed = true;
		}
		if (changed) await hestia.restartDns();
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`/edit/dns?domain=${encodeURIComponent(domain)}&saved=1`);
}
