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
	const subjectMatch = template.match(/<subject>(.*?)<\/subject>/is);
	let subject = "";
	let body = template;
	if (subjectMatch) {
		subject = subjectMatch[1];
		body = template.replace(subjectMatch[0], "");
	}
	const replace = (text: string, extra: Record<string, string>) =>
		text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => (key in extra ? extra[key] : match));
	subject = replace(subject, {
		date: vars.date,
		hostname: vars.hostname,
		appname: vars.appname,
		user: vars.user,
	});
	body = replace(body, {
		name: vars.name,
		hostname: vars.hostname,
		user: vars.user,
		resetcode: vars.resetcode,
		appname: vars.appname,
	});
	return { subject, body };
}

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
