#!/usr/bin/env node
/**
 * Extract the panel's dictionaries from HestiaCP's compiled gettext
 * catalogs (web/locale/<lang>/LC_MESSAGES/hestiacp.mo) into JSON files
 * under apps/panel/locales/<lang>.json: { msgid: msgstr }.
 *
 * The .mo files are the only translation artifacts in the repo (the .po
 * sources live in Crowdin, per crowdin.yml), so this script parses the
 * .mo binary format directly — header + string tables, little- or
 * big-endian. Plural entries (msgid containing \0) keep their first
 * form; untranslated entries (empty msgstr) are omitted, since lookup
 * falls back to the msgid exactly like gettext. Keys are sorted so the
 * output is deterministic and CI can gate on a clean diff.
 *
 * Run: pnpm --filter @hestiacp/panel i18n:extract
 */
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const localeRoot = join(here, "..", "..", "..", "web", "locale");
const outDir = join(here, "..", "locales");

function parseMo(buf) {
	const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
	const magic = view.getUint32(0, true);
	let le;
	if (magic === 0x950412de) le = true;
	else if (view.getUint32(0, false) === 0x950412de) le = false;
	else throw new Error("not a .mo file (bad magic)");
	const n = view.getUint32(8, le);
	const oOffset = view.getUint32(12, le);
	const tOffset = view.getUint32(16, le);
	const text = new TextDecoder("utf-8");
	const readStr = (table, i) => {
		const len = view.getUint32(table + i * 8, le);
		const off = view.getUint32(table + i * 8 + 4, le);
		return text.decode(buf.subarray(off, off + len));
	};
	const dict = {};
	for (let i = 0; i < n; i++) {
		const msgid = readStr(oOffset, i);
		const msgstr = readStr(tOffset, i);
		if (msgid === "" || msgstr === "") continue; // header / untranslated
		const key = msgid.split("\0")[0];
		const value = msgstr.split("\0")[0];
		if (value) dict[key] = value;
	}
	return dict;
}

const langs = (await readdir(localeRoot, { withFileTypes: true }))
	.filter((e) => e.isDirectory())
	.map((e) => e.name)
	.sort();

await mkdir(outDir, { recursive: true });
let total = 0;
for (const lang of langs) {
	const moPath = join(localeRoot, lang, "LC_MESSAGES", "hestiacp.mo");
	let dict;
	try {
		dict = parseMo(await readFile(moPath));
	} catch {
		continue; // directory without a catalog (e.g. tooling dirs)
	}
	const sorted = Object.fromEntries(
		Object.entries(dict).sort(([a], [b]) => (a < b ? -1 : 1)),
	);
	await writeFile(
		join(outDir, `${lang}.json`),
		`${JSON.stringify(sorted, null, "\t")}\n`,
	);
	total += Object.keys(sorted).length;
	console.log(`${lang}: ${Object.keys(sorted).length} strings`);
}
console.log(`Wrote ${langs.length} locale files, ${total} translated strings total.`);
