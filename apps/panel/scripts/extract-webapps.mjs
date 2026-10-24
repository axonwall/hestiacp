/**
 * Extract the WebApp quick-install catalog from the PHP installer
 * classes (web/src/app/WebApp/Installers/<App>/<App>Setup.php) into
 * apps/panel/data/webapps.json — the same generate-and-commit pattern
 * as the locale dictionaries. The PHP $info/$config arrays are
 * regular enough for a tolerant scanner: info strings, form fields
 * (string shorthand or array descriptors with type/value/options),
 * the database flag, and resource types.
 *
 * Run: pnpm --filter @hestiacp/panel webapps:extract
 */
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const installersDir = join(here, "../../../web/src/app/WebApp/Installers");

function balancedSlice(text, startIdx) {
	// startIdx points at '['; returns the slice through the matching ']'
	let depth = 0;
	let quote = null;
	for (let i = startIdx; i < text.length; i++) {
		const ch = text[i];
		if (quote) {
			if (ch === quote && text[i - 1] !== "\\") quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		else if (ch === "[") depth++;
		else if (ch === "]") {
			depth--;
			if (depth === 0) return text.slice(startIdx, i + 1);
		}
	}
	return "";
}

function stringField(block, key) {
	const m = block.match(new RegExp(`["']${key}["']\\s*=>\\s*["']([^"']*)["']`));
	return m ? m[1] : "";
}

function parseOptions(block) {
	const options = [];
	const pairRe = /["']([^"']+)["']\s*=>\s*["']([^"']*)["']/g;
	let m;
	while ((m = pairRe.exec(block))) options.push({ value: m[1], label: m[2] });
	if (options.length) return options;
	const listRe = /["']([^"']+)["']\s*,/g;
	while ((m = listRe.exec(block))) options.push({ value: m[1], label: m[1] });
	return options;
}

function parseForm(formBlock) {
	const fields = [];
	// iterate top-level entries: split on depth-1 commas by scanning
	let i = 1; // skip '['
	const entries = [];
	let depth = 0;
	let quote = null;
	let start = i;
	for (; i < formBlock.length - 1; i++) {
		const ch = formBlock[i];
		if (quote) {
			if (ch === quote && formBlock[i - 1] !== "\\") quote = null;
			continue;
		}
		if (ch === '"' || ch === "'") quote = ch;
		else if (ch === "[") depth++;
		else if (ch === "]") depth--;
		else if (ch === "," && depth === 0) {
			entries.push(formBlock.slice(start, i));
			start = i + 1;
		}
	}
	entries.push(formBlock.slice(start));
	for (const entry of entries) {
		const keyMatch = entry.match(/["']([A-Za-z0-9_]+)["']\s*=>\s*(.*)$/s);
		if (!keyMatch) continue;
		const key = keyMatch[1];
		const descriptor = keyMatch[2].trim();
		if (/^["']/.test(descriptor)) {
			fields.push({ key, type: descriptor.replace(/["']/g, "") });
			continue;
		}
		if (descriptor.startsWith("[")) {
			const type = stringField(descriptor, "type") || "text";
			const value = stringField(descriptor, "value");
			const field = { key, type };
			if (value) field.value = value;
			const optionsIdx = descriptor.search(/["']options["']\s*=>\s*\[/);
			if (optionsIdx >= 0) {
				const optionsBlock = balancedSlice(descriptor, descriptor.indexOf("[", optionsIdx));
				field.options = parseOptions(optionsBlock);
			}
			fields.push(field);
		}
	}
	return fields;
}

const catalog = [];
for (const file of globSync(join(installersDir, "*/*Setup.php")).sort()) {
	const php = readFileSync(file, "utf8");
	const infoIdx = php.search(/\$(info)\s*=\s*\[/);
	const infoBlock = infoIdx >= 0 ? balancedSlice(php, php.indexOf("[", infoIdx)) : "";
	const configIdx = php.search(/\$(config)\s*=\s*\[/);
	const configBlock = configIdx >= 0 ? balancedSlice(php, php.indexOf("[", configIdx)) : "";
	const formIdx = configBlock.search(/["']form["']\s*=>\s*\[/);
	const formBlock = formIdx >= 0 ? balancedSlice(configBlock, configBlock.indexOf("[", formIdx)) : "[]";
	catalog.push({
		name: stringField(infoBlock, "name"),
		group: stringField(infoBlock, "group"),
		version: stringField(infoBlock, "version") || "latest",
		thumbnail: stringField(infoBlock, "thumbnail"),
		database: /["']database["']\s*=>\s*true/.test(configBlock),
		form: parseForm(formBlock),
	});
}

const out = join(here, "../data/webapps.json");
writeFileSync(out, JSON.stringify(catalog, null, 2) + "\n");
console.log(`webapps: ${catalog.length} installers -> ${out}`);
