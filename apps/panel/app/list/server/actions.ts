"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	errorMessage,
	hestia,
	requireAdmin,
} from "@/lib/panel";

/** Start / stop / restart a system service from /list/server. */
export async function serviceControlAction(formData: FormData): Promise<void> {
	const session = await requireAdmin();
	if (!csrfValid(session, formData)) redirect("/list/server?error=csrf");
	const service = String(formData.get("service") ?? "");
	const op = String(formData.get("op") ?? "");
	try {
		if (op === "start") await hestia.startService(service);
		else if (op === "stop") await hestia.stopService(service);
		else if (op === "restart") await hestia.restartService(service);
	} catch (error) {
		redirect(`/list/server?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/server?saved=1");
}
