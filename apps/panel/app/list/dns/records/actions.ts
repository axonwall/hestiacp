"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Bulk DNS-record action (PHP /bulk/dns/): suspend/unsuspend/delete. */
export async function bulkDnsRecordAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/dns?error=csrf");
	const user = effectiveUser(session);
	const op = String(formData.get("action") ?? "");
	const domain = String(formData.get("domain") ?? "");
	const ids = formData.getAll("record[]").map(String).filter(Boolean);
	try {
		for (const id of ids) {
			if (op === "suspend") await hestia.suspendDnsRecord(user, domain, id);
			else if (op === "unsuspend") await hestia.unsuspendDnsRecord(user, domain, id);
			else if (op === "delete") await hestia.deleteDnsRecord(user, domain, id);
		}
	} catch (error) {
		redirect(
			`/list/dns/records?domain=${encodeURIComponent(domain)}&error=${encodeURIComponent(errorMessage(error))}`,
		);
	}
	redirect(`/list/dns/records?domain=${encodeURIComponent(domain)}&saved=1`);
}
