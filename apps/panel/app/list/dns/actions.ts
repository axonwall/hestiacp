"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Suspend/unsuspend a DNS zone from the list, mirroring the PHP bulk endpoints. */
export async function toggleDnsDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/dns?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendDnsDomain(user, domain);
		} else {
			await hestia.unsuspendDnsDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/dns?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/dns?saved=1");
}
