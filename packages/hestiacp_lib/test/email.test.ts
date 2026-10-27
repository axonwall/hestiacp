import { describe, expect, it } from "vitest";
import { composeResetEmail, RESET_EMAIL_FALLBACK_BODY } from "../src/email";

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
