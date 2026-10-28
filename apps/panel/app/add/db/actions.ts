"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sendMail } from "@/lib/mail";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";
import { composeDatabaseCredentialsEmail } from "@hestiacp/lib";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Create a database (web/add/db). Database and user are SUFFIXES —
 *  v-add-database prefixes them with "<user>_" itself. When a
 *  notify address is given (server-validated, as PHP validates
 *  v_db_email before creation), the credentials email goes out
 *  after creation in the session language. */
export async function addDatabaseAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	if (!csrfValid(session, formData)) redirect("/add/db?error=csrf");
	const user = effectiveUser(session);
	const database = String(formData.get("database") ?? "")
		.trim()
		.toLowerCase();
	const dbuser = String(formData.get("dbuser") ?? "")
		.trim()
		.toLowerCase();
	const secret = String(formData.get("secret") ?? "");
	const type = String(formData.get("type") ?? "mysql");
	const host = String(formData.get("host") ?? "localhost");
	const notifyEmail = String(formData.get("notifyEmail") ?? "").trim();
	if (!database || !dbuser || !secret) redirect("/add/db?error=missing");
	if (notifyEmail && !EMAIL_RE.test(notifyEmail)) {
		redirect("/add/db?error=Please%20enter%20a%20valid%20email%20address.");
	}
	try {
		await hestia.addDatabase(
			user,
			database,
			dbuser,
			secret,
			type,
			host,
			String(formData.get("charset") ?? "utf8mb4"),
		);
	} catch (error) {
		redirect(`/add/db?error=${encodeURIComponent(errorMessage(error))}`);
	}
	if (notifyEmail) {
		const sys = (await hestia.listSysConfig().catch(() => null))?.config ?? {};
		const info = await hestia.listSysInfo().catch(() => null);
		const hostHeader = (await headers()).get("host") ?? "";
		const requestHost = hostHeader.split(":")[0] || info?.HOSTNAME || "localhost";
		// PHP's dbadmin link uses the request host, unless the posted
		// database host is not localhost — then it uses that instead.
		const linkHost = host !== "localhost" ? host : requestHost;
		let dbadmin = "";
		if (type === "mysql") {
			dbadmin = sys.DB_PMA_ALIAS
				? `https://${linkHost}/${sys.DB_PMA_ALIAS}`
				: `https://${linkHost}/phpmyadmin/`;
		} else if (type === "pgsql") {
			dbadmin = sys.DB_PGA_ALIAS
				? `https://${linkHost}/${sys.DB_PGA_ALIAS}`
				: `https://${linkHost}/phppgadmin/`;
		}
		const hostname = info?.HOSTNAME || requestHost;
		const rawLanguage = session.data.language;
		const template = await hestia.readEmailTemplate(
			"database_credentials",
			typeof rawLanguage === "string" ? rawLanguage : "en",
		);
		const { subject, body } = composeDatabaseCredentialsEmail(
			template,
			{
				hostname,
				appname: sys.APP_NAME || "HestiaCP",
				database: `${user}_${database}`,
				username: `${user}_${dbuser}`,
				password: secret,
				dbadmin,
			},
			sys.SUBJECT_EMAIL || "{{subject}}",
		);
		await sendMail(sys, {
			to: notifyEmail,
			subject,
			body,
			fromFallbackHost: hostname,
		});
	}
	redirect("/list/db?saved=1");
}
