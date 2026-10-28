"use server";

import { redirect } from "next/navigation";
import { csrfValid, hestia, requireSession, sessions } from "@/lib/panel";

const KEY_ALGOS = ["ecdsa-256", "ecdsa-384", "rsa"];

/**
 * Generate a self-signed cert (web/generate/ssl/): validate, call
 * v-generate-ssl-cert with PHP's exact argument shape (org unit
 * hardcoded to IT, aliases newline-joined, format json), stash
 * the result in the session, and redirect to the result view.
 * The stash is read once and cleared, like the access-key secret.
 */
export async function generateSslAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) {
		redirect("/generate/ssl?error=csrf");
	}
	const domain = String(formData.get("domain") ?? "").trim();
	const aliasesRaw = String(formData.get("aliases") ?? "");
	const email = String(formData.get("email") ?? "").trim();
	const country = String(formData.get("country") ?? "").trim();
	const state = String(formData.get("state") ?? "").trim();
	const locality = String(formData.get("locality") ?? "").trim();
	const org = String(formData.get("org") ?? "").trim();
	const keyAlgo = String(formData.get("keyAlgo") ?? "ecdsa-256");
	const missing = [domain, country, state, locality, org].some((v) => !v);
	if (missing) {
		redirect(
			`/generate/ssl?error=${encodeURIComponent("Field cannot be blank.")}&domain=${encodeURIComponent(domain)}`,
		);
	}
	if (!KEY_ALGOS.includes(keyAlgo)) {
		redirect("/generate/ssl?error=Invalid%20key%20algorithm%20selected.");
	}
	const aliases = aliasesRaw
		.replace(/\n/g, " ")
		.replace(/,/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.split(" ")
		.filter(Boolean)
		.join("\n");
	try {
		const record = await hestia.generateSslCert(
			domain,
			email,
			country,
			state,
			locality,
			org,
			aliases,
			keyAlgo,
		);
		session.data.hestiang_generated_ssl = JSON.stringify({ domain, ...record });
		await sessions.set(session.id, session.data);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Error";
		redirect(`/generate/ssl?error=${encodeURIComponent(message)}`);
	}
	redirect("/generate/ssl?generated=1");
}
