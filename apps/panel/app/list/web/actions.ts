"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	errorMessage,
	hestia,
	requireSession,
} from "@/lib/panel";

/** Suspend/unsuspend a web domain from the list, mirroring the PHP bulk endpoints. */
export async function toggleWebDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/web?error=csrf");
	const user = effectiveUser(session);
	const domain = String(formData.get("domain") ?? "");
	try {
		if (formData.get("op") === "suspend") {
			await hestia.suspendWebDomain(user, domain);
		} else {
			await hestia.unsuspendWebDomain(user, domain);
		}
	} catch (error) {
		redirect(`/list/web?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/web?saved=1");
}
