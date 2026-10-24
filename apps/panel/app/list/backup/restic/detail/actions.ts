"use server";

import { redirect } from "next/navigation";
import {
	csrfValid,
	effectiveUser,
	hestia,
	requireSession,
} from "@/lib/panel";

function target(formData: FormData): string {
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	return `/list/backup/restic/detail?snapshot=${encodeURIComponent(snapshot)}&notice=scheduled`;
}

export async function restoreResticFullAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	await hestia.scheduleUserRestoreRestic(effectiveUser(session), snapshot);
	redirect(target(formData));
}

export async function restoreResticObjectAction(formData: FormData) {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/list/backup/restic?error=csrf");
	const snapshot = formData.get("snapshot")?.toString() ?? "";
	const type = formData.get("type")?.toString() ?? "";
	const object = formData.get("object")?.toString() ?? "";
	const user = effectiveUser(session);
	if (type === "cron") {
		await hestia.scheduleUserRestoreRestic(user, snapshot, "cron");
	} else {
		await hestia.scheduleUserRestoreRestic(user, snapshot, type, object);
	}
	redirect(target(formData));
}
