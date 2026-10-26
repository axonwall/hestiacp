/**
 * PHP humanize_usage_size/humanize_usage_measure (web/inc/main.php),
 * ported exactly: the input is a usage in MB, the output is a
 * display number (2 decimals by default, en-US grouping) plus a unit.
 * PHP's size function takes a decimals argument (the users list
 * passes 1); the measure is unaffected by it. The divide chain is:
 * >1024 MB -> GB, >1024 GB -> TB, >1024 TB -> PB, with the >999 bump
 * that keeps "1024 MB" rendering as "1.00 gb" rather than "1024.00 mb".
 * "unlimited" renders as infinity with no unit, matching PHP's "∞" +
 * empty measure.
 */
export function humanizeUsage(usage: string, decimals = 2): { size: string; measure: string } {
	if (usage === "unlimited") return { size: "∞", measure: "" };
	const fmt = (n: number): string =>
		n.toLocaleString("en-US", {
			minimumFractionDigits: decimals,
			maximumFractionDigits: decimals,
		});
	let u = Number(usage);
	if (Number.isNaN(u)) return { size: usage, measure: "" };
	if (u < 1) u = 0;
	let display = u;
	if (u > 1024) {
		u /= 1024;
		if (u > 1024) {
			u /= 1024;
			if (u > 1024) {
				u /= 1024;
				display = u;
			} else {
				if (u > 999) u /= 1024;
				display = u;
			}
		} else {
			if (u > 999) u /= 1024;
			display = u;
		}
	} else {
		if (u > 999) u /= 1024;
		display = u;
	}
	// Recompute the measure with the same divisions PHP applies.
	let m = Number(usage);
	if (Number.isNaN(m) || m < 1) m = 0;
	let measure: string;
	if (m > 1024) {
		m /= 1024;
		if (m > 1024) {
			m /= 1024;
			measure = m < 1024 ? "tb" : "pb";
			if (m > 999) {
				m /= 1024;
				measure = "pb";
			}
		} else {
			measure = m < 1024 ? "gb" : "tb";
			if (m > 999) {
				m /= 1024;
				measure = "tb";
			}
		}
	} else {
		measure = m < 1024 ? "mb" : "gb";
		if (m > 999) measure = "gb";
	}
	return { size: fmt(display), measure };
}

/**
 * PHP humanize_time (web/inc/main.php), ported exactly: the input is
 * a duration in minutes (backup RUNTIME). >=60 minutes rounds to
 * hours, >=24 hours rounds to days; otherwise minutes. The caller
 * supplies the translator for the unit words (PHP uses ngettext).
 */
export function humanizeTime(usage: string, t: (s: string) => string): string {
	let n = Number(usage);
	if (Number.isNaN(n)) n = 0;
	if (n >= 60) {
		n = Math.round(n / 60);
		if (n >= 24) {
			n = Math.round(n / 24);
			return `${n} ${n === 1 ? t("day") : t("days")}`;
		}
		return `${n} ${n === 1 ? t("hour") : t("hours")}`;
	}
	n = Math.round(n);
	return `${n} ${n === 1 ? t("minute") : t("minutes")}`;
}
