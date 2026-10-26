"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/** Acknowledge / delete a notification from the list. */
export async function acknowledgeNotificationAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/notifications?error=csrf");
	try {
		await hestia.acknowledgeUserNotification(
			effectiveUser(session),
			String(formData.get("notice") ?? ""),
		);
	} catch (error) {
		redirect(`/list/notifications?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/notifications?saved=1");
}

export async function deleteNotificationAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/notifications?error=csrf");
	try {
		await hestia.deleteUserNotification(
			effectiveUser(session),
			String(formData.get("notice") ?? ""),
		);
	} catch (error) {
		redirect(`/list/notifications?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/list/notifications?saved=1");
}
