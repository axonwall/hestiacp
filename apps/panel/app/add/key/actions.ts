"use server";

import { createHash } from "node:crypto";
import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

/**
 * Add an SSH key (PHP /add/key/): the key must have a type, key
 * material, and comment; a missing comment defaults to md5(unix time),
 * and a duplicate comment or duplicate key material is rejected with
 * PHP's "SSH Key already exists." message.
 */
export async function addSshKeyAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) {
		redirect("/add/key?error=csrf");
	}
	const user = effectiveUser(session);
	let key = String(formData.get("v_key") ?? "").trim();
	const parts = key.split(/\s+/);
	if (parts.length < 2) {
		redirect(`/add/key?error=${encodeURIComponent("Invalid SSH key")}`);
	}
	if (parts.length < 3) {
		const stamp = createHash("md5")
			.update(String(Math.floor(Date.now() / 1000)))
			.digest("hex");
		key = `${key} ${stamp}`;
		parts.push(stamp);
	}
	const existing = await hestia.listUserSshKeys(user).catch(() => ({}));
	const ids = Object.values(existing).map((row) => (row.ID ?? "").trim());
	const materials = Object.values(existing).map((row) => (row.KEY ?? "").trim());
	if (ids.includes(parts[2]) || materials.includes(parts[1])) {
		redirect(`/add/key?error=${encodeURIComponent("SSH Key already exists.")}`);
	}
	try {
		await hestia.addUserSshKey(user, key);
	} catch (error) {
		redirect(`/add/key?error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect("/add/key?saved=1");
}
