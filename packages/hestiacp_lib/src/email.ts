/** {{key}} substitution; unknown placeholders stay literal, as PHP's translate_email leaves them. */
function replaceVars(text: string, vars: Record<string, string>): string {
	return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in vars ? vars[key] : match));
}

/** Split a template's <subject> block from its body (no block → empty subject). */
function splitSubject(template: string): { subject: string; body: string } {
	const match = template.match(/<subject>(.*?)<\/subject>/is);
	if (!match) return { subject: "", body: template };
	return { subject: match[1], body: template.replace(match[0], "") };
}

/**
 * PHP's subject fallback: SUBJECT_EMAIL (default "{{subject}}") with
 * {{subject}} / {{hostname}} / {{appname}} replaced. Callers pass the
 * per-mail fallback subject ("Welcome to …", "Database Credentials:
 * …", "Email Credentials: …").
 */
function fallbackSubject(
	subjectEmail: string,
	fallback: string,
	hostname: string,
	appname: string,
): string {
	return replaceVars(subjectEmail, { subject: fallback, hostname, appname });
}

/**
 * Compose a Hestia password-reset email (web/reset/index.php):
 * the template's <subject>...</subject> block becomes the subject
 * with {{date}} / {{hostname}} / {{appname}} / {{user}} replaced
 * and is stripped from the body; the body replaces {{name}},
 * {{hostname}}, {{user}}, {{resetcode}}, {{appname}}. Pure, so the
 * composition is unit-testable without sending anything.
 */
export function composeResetEmail(
	template: string,
	vars: {
		date: string;
		hostname: string;
		appname: string;
		user: string;
		name: string;
		resetcode: string;
	},
): { subject: string; body: string } {
	const { subject: subjectTpl, body: bodyTpl } = splitSubject(template);
	const subject = replaceVars(subjectTpl, {
		date: vars.date,
		hostname: vars.hostname,
		appname: vars.appname,
		user: vars.user,
	});
	const body = replaceVars(bodyTpl, {
		name: vars.name,
		hostname: vars.hostname,
		user: vars.user,
		resetcode: vars.resetcode,
		appname: vars.appname,
	});
	return { subject, body };
}

/**
 * Compose an account-ready email (web/add/user/index.php), sent in
 * the NEW user's language. The caller invokes it twice when the
 * subject and body hostnames differ, as PHP does: once with the
 * bare system hostname for the subject, once with the request
 * host+port for the body (reset flow's convention). `template`
 * null selects the fallback body; an empty subject (no <subject>
 * block, or an empty one) falls back through SUBJECT_EMAIL.
 */
export function composeAccountReadyEmail(
	template: string | null,
	vars: {
		hostname: string;
		appname: string;
		user: string;
		name: string;
		password: string;
	},
	subjectEmail: string,
): { subject: string; body: string } {
	const { subject: subjectTpl, body: bodyTpl } = template
		? splitSubject(template)
		: { subject: "", body: ACCOUNT_READY_FALLBACK_BODY };
	let subject = replaceVars(subjectTpl, {
		hostname: vars.hostname,
		appname: vars.appname,
		user: vars.user,
		name: vars.name,
	});
	if (!subject) {
		subject = fallbackSubject(
			subjectEmail,
			`Welcome to ${vars.appname}`,
			vars.hostname,
			vars.appname,
		);
	}
	const body = replaceVars(bodyTpl, {
		name: vars.name,
		user: vars.user,
		password: vars.password,
		hostname: vars.hostname,
		appname: vars.appname,
	});
	return { subject, body };
}

/**
 * Compose a database-credentials email (web/add/db/index.php).
 * Subject and body share the bare system hostname here, so one
 * call covers both. Note PHP's subject key is the literal typo
 * {{dabase}} (the body uses {{database}}); both are reproduced.
 */
export function composeDatabaseCredentialsEmail(
	template: string | null,
	vars: {
		hostname: string;
		appname: string;
		database: string;
		username: string;
		password: string;
		dbadmin: string;
	},
	subjectEmail: string,
): { subject: string; body: string } {
	const { subject: subjectTpl, body: bodyTpl } = template
		? splitSubject(template)
		: { subject: "", body: DATABASE_CREDENTIALS_FALLBACK_BODY };
	let subject = replaceVars(subjectTpl, {
		hostname: vars.hostname,
		appname: vars.appname,
		dabase: vars.database,
		dbuser: vars.username,
	});
	if (!subject) {
		subject = fallbackSubject(
			subjectEmail,
			`Database Credentials: ${vars.database}`,
			vars.hostname,
			vars.appname,
		);
	}
	const body = replaceVars(bodyTpl, {
		database: vars.database,
		username: vars.username,
		password: vars.password,
		dbadmin: vars.dbadmin,
		appname: vars.appname,
	});
	return { subject, body };
}

/**
 * Compose a mail-credentials email (web/add/mail/index.php, account
 * form). The caller invokes it twice, as PHP's hostnames differ:
 * once with the bare system hostname for the subject, once with
 * "mail." + domain for the body hostname.
 */
export function composeEmailCredentialsEmail(
	template: string | null,
	vars: {
		hostname: string;
		appname: string;
		account: string;
		domain: string;
		password: string;
		webmail: string;
	},
	subjectEmail: string,
): { subject: string; body: string } {
	const { subject: subjectTpl, body: bodyTpl } = template
		? splitSubject(template)
		: { subject: "", body: EMAIL_CREDENTIALS_FALLBACK_BODY };
	let subject = replaceVars(subjectTpl, {
		hostname: vars.hostname,
		appname: vars.appname,
		account: vars.account,
		domain: vars.domain,
	});
	if (!subject) {
		subject = fallbackSubject(
			subjectEmail,
			`Email Credentials: ${vars.account}@${vars.domain}`,
			vars.hostname,
			vars.appname,
		);
	}
	const body = replaceVars(bodyTpl, {
		domain: vars.domain,
		account: vars.account,
		password: vars.password,
		webmail: vars.webmail,
		hostname: vars.hostname,
		appname: vars.appname,
	});
	return { subject, body };
}

/** PHP's fallback body when no account_ready template exists. */
export const ACCOUNT_READY_FALLBACK_BODY = [
	"Hello {{name}},",
	"",
	"Your account has been created and ready to use.",
	"",
	"https://{{hostname}}/login/",
	"Username: {{user}}",
	"Password: {{password}}",
	"",
	"Best regards,",
	"",
	"--",
	"{{appname}}",
].join("\n");

/** PHP's fallback body when no database_credentials template exists. */
export const DATABASE_CREDENTIALS_FALLBACK_BODY = [
	"Database has been created.",
	"",
	"Database: {{database}}",
	"Username: {{username}}",
	"Password: {{password}}",
	"SQL Manager: {{dbadmin}}",
	"",
	"Best regards,",
	"",
	"--",
	"{{appname}}",
].join("\n");

/** PHP's fallback body when no email_credentials template exists. */
export const EMAIL_CREDENTIALS_FALLBACK_BODY = [
	"Mail account has been created.",
	"",
	"Common Account Settings:",
	"Username: {{account}}@{{domain}}",
	"Password: {{password}}",
	"Webmail: {{webmail}}",
	"Hostname: {{hostname}}",
	"",
	"IMAP Settings",
	"Authentication: Normal Password",
	"SSL/TLS: Port 993",
	"STARTTLS: Port 143",
	"No encryption: Port 143",
	"",
	"POP3 Settings",
	"Authentication: Normal Password",
	"SSL/TLS: Port 995",
	"STARTTLS: Port 110",
	"No encryption: Port 110",
	"",
	"SMTP Settings",
	"Authentication: Normal Password",
	"SSL/TLS: Port 465",
	"STARTTLS: Port 587",
	"No encryption: Port 25",
	"",
	"Best regards,",
	"",
	"--",
	"{{appname}}",
].join("\n");

/** PHP's fallback body when no reset_password template exists. */
export const RESET_EMAIL_FALLBACK_BODY = [
	"Hello {{name}},",
	"",
	"To reset your {{appname}} password, please follow this link:",
	"https://{{hostname}}/reset/?action=confirm&user={{user}}&code={{resetcode}}",
	"",
	"Alternatively, you may go to https://{{hostname}}/reset/?action=code&user={{user}} and enter the following reset code:",
	"{{resetcode}}",
	"",
	"If you did not request password reset, please ignore this message and accept our apologies.",
	"",
	"Best regards,",
	"",
	"--",
	"{{appname}}",
].join("\n");
