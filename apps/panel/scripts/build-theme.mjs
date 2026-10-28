#!/usr/bin/env node
/**
 * Builds the panel's Hestia theme assets (D6 visual parity): bundles
 * upstream's own theme stylesheets with the same lightningcss recipe
 * as the root build.js, and copies the static assets they reference
 * (webfonts, FontAwesome fonts, logos) into the panel's public dir.
 * Output is committed; CI re-runs this and fails on drift, like the
 * locale and WebApp catalog extractors.
 *
 *   node scripts/build-theme.mjs [--check]
 */
import { createRequire } from "node:module";
import { copyFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const panelDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const rootDir = join(panelDir, "..", "..");
const require = createRequire(join(rootDir, "package.json"));
const lightningcss = require("lightningcss");
const browserslist = require("browserslist");

const checkOnly = process.argv.includes("--check");
let drift = 0;

async function emit(relPath, content) {
	const dest = join(panelDir, "public", relPath);
	if (checkOnly) {
		const current = await readFile(dest).catch(() => null);
		if (!current?.equals(content)) {
			console.error(`theme drift: public/${relPath}`);
			drift++;
		}
		return;
	}
	await mkdir(dirname(dest), { recursive: true });
	await writeFile(dest, content);
}

async function copyInto(srcAbs, relPath) {
	await emit(relPath, await readFile(srcAbs));
}

// --- CSS bundles (upstream build.js processCSS, minus source maps) ---
const themesDir = join(rootDir, "web", "css", "src", "themes");
for (const entry of await readdir(themesDir)) {
	if (!entry.endsWith(".css")) continue;
	const inputPath = join(themesDir, entry);
	const css = await readFile(inputPath);
	const bundle = await lightningcss.bundleAsync({
		filename: inputPath,
		code: Buffer.from(css),
		minify: true,
		targets: lightningcss.browserslistToTargets(browserslist()),
		drafts: { customMedia: true, nesting: true },
		visitor: {
			Url: (node) => {
				if (node.url.startsWith("../webfonts/")) {
					return { url: node.url.replace("../webfonts/", "/webfonts/"), loc: node.loc };
				}
				return node;
			},
		},
		resolver: {
			resolve(specifier, from) {
				if (!specifier.endsWith(".css")) specifier += ".css";
				if (specifier.startsWith("node:")) {
					return join(rootDir, "node_modules", specifier.replace("node:", ""));
				}
				return join(dirname(from), specifier);
			},
		},
	});
	await emit(join("hestia", "themes", entry.replace(".css", ".min.css")), bundle.code);
	console.log(`bundled theme: ${entry}`);
}

// --- Static assets ---
// web/webfonts ships Hestia's own font files, including its pinned
// fa-brands/fa-solid copies; upstream pairs those exact files with
// the node_modules-bundled FontAwesome CSS, so they win here too.
// node_modules only supplements what web/webfonts lacks.
const emittedFonts = new Set();
for (const f of await readdir(join(rootDir, "web", "webfonts"))) {
	emittedFonts.add(f);
	await copyInto(join(rootDir, "web", "webfonts", f), join("webfonts", f));
}
const faFonts = join(rootDir, "node_modules", "@fortawesome", "fontawesome-free", "webfonts");
for (const f of await readdir(faFonts)) {
	if (emittedFonts.has(f)) continue;
	await copyInto(join(faFonts, f), join("webfonts", f));
}
for (const f of ["logo.svg", "logo-header.svg", "favicon.png", "arrow.svg"]) {
	await copyInto(join(rootDir, "web", "images", f), join("images", f));
}
console.log("theme assets done");
if (checkOnly && drift > 0) {
	console.error(`${drift} theme asset(s) out of date — run node scripts/build-theme.mjs`);
	process.exit(1);
}
