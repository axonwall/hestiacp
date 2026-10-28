import { describe, expect, it } from "vitest";
import { humanizeTime, humanizeUsage } from "../src/humanize";

describe("humanizeUsage", () => {
	it("formats with 2 decimals by default", () => {
		expect(humanizeUsage("1536")).toEqual({ size: "1.50", measure: "gb" });
		expect(humanizeUsage("0")).toEqual({ size: "0.00", measure: "mb" });
	});
	it("honors the decimals argument (PHP's users list passes 1)", () => {
		expect(humanizeUsage("1536", 1)).toEqual({ size: "1.5", measure: "gb" });
		expect(humanizeUsage("0", 1)).toEqual({ size: "0.0", measure: "mb" });
		expect(humanizeUsage("512", 1)).toEqual({ size: "512.0", measure: "mb" });
	});
	it("renders unlimited as infinity with no unit", () => {
		expect(humanizeUsage("unlimited", 1)).toEqual({ size: "∞", measure: "" });
	});
});

describe("humanizeTime", () => {
	const t = (s: string) => s;
	it("renders minutes, hours, and days", () => {
		expect(humanizeTime("5", t)).toBe("5 minutes");
		expect(humanizeTime("90", t)).toBe("2 hours");
		expect(humanizeTime("2880", t)).toBe("2 days");
	});
});
