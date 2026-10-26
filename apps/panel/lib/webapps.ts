import catalogData from "../data/webapps.json";

export interface WebAppCatalogField {
	key: string;
	type: string;
	value?: string;
	options?: Array<{ value: string; label: string }>;
}

export interface WebAppCatalogEntry {
	name: string;
	group: string;
	version: string;
	thumbnail: string;
	database: boolean;
	form: WebAppCatalogField[];
}

/**
 * The quick-install catalog, generated from the PHP installer classes
 * by scripts/extract-webapps.mjs (committed at data/webapps.json).
 */
export const WEBAPP_CATALOG = catalogData as WebAppCatalogEntry[];

export function catalogEntry(name: string): WebAppCatalogEntry | undefined {
	return WEBAPP_CATALOG.find((a) => a.name === name);
}
