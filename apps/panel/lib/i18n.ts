/**
 * Panel i18n, built on HestiaCP's own gettext catalogs.
 *
 * Dictionaries live in apps/panel/locales/<lang>.json, extracted from
 * web/locale/<lang>/LC_MESSAGES/hestiacp.mo by scripts/extract-locales.mjs
 * (rerun when upstream translations change; CI gates on a clean diff).
 * Lookup follows gettext semantics: a missing locale or a missing string
 * falls back to the msgid itself (the English source text), so wiring a
 * string through t() is always safe even before it is translated.
 *
 * Interpolation matches the PHP panel's sprintf style: %s consumes the
 * next argument in order, %1$s..%9$s address arguments positionally.
 */

type Dictionary = Record<string, string>;

const cache = new Map<string, Promise<Dictionary>>();

export function loadDictionary(locale: string): Promise<Dictionary> {
	let pending = cache.get(locale);
	if (!pending) {
		pending = (async () => {
			try {
				const mod = await import(`../locales/${locale}.json`);
				return (mod.default ?? mod) as Dictionary;
			} catch {
				return {};
			}
		})();
		cache.set(locale, pending);
	}
	return pending;
}

export type Translator = (msgid: string, ...args: Array<string | number>) => string;

export function createTranslator(dict: Dictionary): Translator {
	return (msgid, ...args) => {
		const template = dict[msgid] ?? msgid;
		if (args.length === 0) return template;
		let sequential = 0;
		return template.replace(/%(\d+)\$s|%s/g, (match, positional) => {
			const idx = positional ? Number(positional) - 1 : sequential++;
			const value = args[idx];
			return value === undefined ? match : String(value);
		});
	};
}

export async function getTranslator(locale: string): Promise<Translator> {
	if (!locale || locale === "en") return createTranslator({});
	return createTranslator(await loadDictionary(locale));
}
