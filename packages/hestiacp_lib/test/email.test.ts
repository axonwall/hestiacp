import { describe, expect, it } from "vitest";
import {
	ACCOUNT_READY_FALLBACK_BODY,
	DATABASE_CREDENTIALS_FALLBACK_BODY,
	EMAIL_CREDENTIALS_FALLBACK_BODY,
	composeAccountReadyEmail,
	composeDatabaseCredentialsEmail,
	composeEmailCredentialsEmail,
	composeResetEmail,
	RESET_EMAIL_FALLBACK_BODY,
} from "../src/email";

const vars = {
	date: "2026-10-27 12:00:00",
	hostname: "panel.example.test:8083",
	appname: "HestiaCP",
	user: "secure",
	name: "Secure User",
	resetcode: "TESTRESETCODE12",
};

describe("composeResetEmail", () => {
	it("extracts the subject and substitutes its vars", () => {
		const { subject, body } = composeResetEmail(
			"<subject>{{hostname}} Password reset at {{date}}</subject>\nHello {{name}}, code {{resetcode}}",
			vars,
		);
		expect(subject).toBe("panel.example.test:8083 Password reset at 2026-10-27 12:00:00");
		expect(body).not.toContain("<subject>");
		expect(body).toContain("Hello Secure User, code TESTRESETCODE12");
	});

	it("leaves unknown placeholders untouched", () => {
		const { body } = composeResetEmail("Hi {{name}}, {{unknown}} stays.", vars);
		expect(body).toBe("Hi Secure User, {{unknown}} stays.");
	});

	it("substitutes every placeholder in the fallback body", () => {
		const { body } = composeResetEmail(RESET_EMAIL_FALLBACK_BODY, vars);
		expect(body).not.toContain("{{");
		expect(body).toContain(
			"https://panel.example.test:8083/reset/?action=confirm&user=secure&code=TESTRESETCODE12",
		);
	});
});

describe("composeAccountReadyEmail", () => {
	const accountVars = {
		hostname: "panel.example.test",
		appname: "HestiaCP",
		user: "demo",
		name: "Demo User",
		password: "s3cret",
	};
	it("extracts the subject and substitutes its vars", () => {
		const { subject, body } = composeAccountReadyEmail(
			"<subject>Welcome to {{appname}}, {{name}}</subject>\nHi {{name}}, {{user}} / {{password}}",
			accountVars,
			"{{subject}}",
		);
		expect(subject).toBe("Welcome to HestiaCP, Demo User");
		expect(body).not.toContain("<subject>");
		expect(body).toContain("Hi Demo User, demo / s3cret");
	});
	it("falls back to the translated body and SUBJECT_EMAIL subject", () => {
		const { subject, body } = composeAccountReadyEmail(null, accountVars, "{{subject}}");
		expect(subject).toBe("Welcome to HestiaCP");
		expect(body).toContain("https://panel.example.test/login/");
		expect(body).toContain("Password: s3cret");
		expect(body).not.toContain("{{");
	});
});

describe("composeDatabaseCredentialsEmail", () => {
	const dbVars = {
		hostname: "panel.example.test",
		appname: "HestiaCP",
		database: "demo_shop",
		username: "demo_shopuser",
		password: "s3cret",
		dbadmin: "https://panel.example.test/phpmyadmin/",
	};
	it("replaces PHP's {{dabase}} typo key in the subject", () => {
		const { subject, body } = composeDatabaseCredentialsEmail(
			"<subject>DB {{dabase}} for {{dbuser}}</subject>\n{{database}} {{username}}",
			dbVars,
			"{{subject}}",
		);
		expect(subject).toBe("DB demo_shop for demo_shopuser");
		// Stripping the <subject> block leaves the template's newline,
		// as PHP's str_replace does too.
		expect(body).toBe("\ndemo_shop demo_shopuser");
	});
	it("falls back to the translated body and SUBJECT_EMAIL subject", () => {
		const { subject, body } = composeDatabaseCredentialsEmail(null, dbVars, "{{subject}}");
		expect(subject).toBe("Database Credentials: demo_shop");
		expect(body).toContain("SQL Manager: https://panel.example.test/phpmyadmin/");
		expect(body).not.toContain("{{");
	});
});

describe("composeEmailCredentialsEmail", () => {
	const mailVars = {
		hostname: "panel.example.test",
		appname: "HestiaCP",
		account: "info",
		domain: "example.com",
		password: "s3cret",
		webmail: "webmail.example.com",
	};
	it("extracts the subject and substitutes its vars", () => {
		const { subject, body } = composeEmailCredentialsEmail(
			"<subject>Mail for {{account}}@{{domain}}</subject>\n{{account}}@{{domain}} via {{webmail}}",
			mailVars,
			"{{subject}}",
		);
		expect(subject).toBe("Mail for info@example.com");
		expect(body).toBe("\ninfo@example.com via webmail.example.com");
	});
	it("falls back to the translated body and SUBJECT_EMAIL subject", () => {
		const { subject, body } = composeEmailCredentialsEmail(null, mailVars, "{{subject}}");
		expect(subject).toBe("Email Credentials: info@example.com");
		expect(body).toContain("Username: info@example.com");
		expect(body).toContain("Webmail: webmail.example.com");
		expect(body).not.toContain("{{");
	});
});
