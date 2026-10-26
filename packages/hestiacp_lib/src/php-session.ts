import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { HestiaConfig } from "./config";

/**
 * PHP session serialization (the `php_serialize` session handler format),
 * restricted to the scalar/flat values Hestia sessions actually carry.
 *
 * This exists because PHP's session files are a cross-app contract in
 * HestiaCP: FileGator (/fm/) and the web terminal's auth shim both read
 * `sess_<id>` files from /usr/local/hestia/data/sessions keyed by the
 * HESTIASID cookie. If the Next panel writes this exact format, both apps
 * keep working untouched (see apps/panel/docs/phase0-audit.md).
 *
 * Format: concatenated `key|<serialized value>` pairs, where a value is
 *   string  s:<byte length>:"<utf8 bytes>";
 *   int     i:<n>;
 *   float   d:<n>;
 *   bool    b:0; / b:1;
 *   null    N;
 *   array   a:<count>:{<serialized key><serialized value>...}
 */
export type PhpValue = string | number | boolean | null | PhpValue[] | { [key: string]: PhpValue };

export type PhpSessionData = Record<string, PhpValue>;

const SESSION_KEY = /^[A-Za-z0-9_]+$/;

export function serializePhpValue(value: PhpValue): string {
	if (value === null) return "N;";
	if (typeof value === "boolean") return value ? "b:1;" : "b:0;";
	if (typeof value === "number") {
		return Number.isInteger(value) ? `i:${value};` : `d:${value};`;
	}
	if (typeof value === "string") {
		return `s:${Buffer.byteLength(value, "utf8")}:"${value}";`;
	}
	if (Array.isArray(value)) {
		const entries = value.map((v, i) => serializePhpValue(i) + serializePhpValue(v)).join("");
		return `a:${value.length}:{${entries}}`;
	}
	const keys = Object.keys(value);
	const entries = keys
		.map((k) => serializePhpValue(k) + serializePhpValue((value as Record<string, PhpValue>)[k]))
		.join("");
	return `a:${keys.length}:{${entries}}`;
}

export function serializePhpSession(data: PhpSessionData): string {
	let out = "";
	for (const [key, value] of Object.entries(data)) {
		if (!SESSION_KEY.test(key)) {
			throw new Error(`Invalid PHP session key: ${key}`);
		}
		out += `${key}|${serializePhpValue(value)}`;
	}
	return out;
}

class Parser {
	private pos = 0;
	constructor(private readonly buf: Buffer) {}

	parseValue(): PhpValue {
		const type = String.fromCharCode(this.buf[this.pos]);
		switch (type) {
			case "N":
				this.expect("N;");
				return null;
			case "b": {
				const v = this.readUntil(";");
				return v.slice(2, -1) === "1";
			}
			case "i": {
				const v = this.readUntil(";");
				return Number.parseInt(v.slice(2, -1), 10);
			}
			case "d": {
				const v = this.readUntil(";");
				return Number.parseFloat(v.slice(2, -1));
			}
			case "s": {
				this.pos += 2; // 's:'
				const lenEnd = this.buf.indexOf(":", this.pos);
				const len = Number.parseInt(this.buf.toString("ascii", this.pos, lenEnd), 10);
				this.pos = lenEnd + 1;
				this.expectChar('"');
				const value = this.buf.toString("utf8", this.pos, this.pos + len);
				this.pos += len;
				this.expect('";');
				return value;
			}
			case "a": {
				this.pos += 2; // 'a:'
				const lenEnd = this.buf.indexOf(":", this.pos);
				const count = Number.parseInt(this.buf.toString("ascii", this.pos, lenEnd), 10);
				this.pos = lenEnd + 1;
				this.expectChar("{");
				const entries: [PhpValue, PhpValue][] = [];
				let isList = true;
				for (let i = 0; i < count; i++) {
					const k = this.parseValue();
					const v = this.parseValue();
					if (k !== i) isList = false;
					entries.push([k, v]);
				}
				this.expectChar("}");
				if (isList) return entries.map(([, v]) => v);
				const obj: Record<string, PhpValue> = {};
				for (const [k, v] of entries) obj[String(k)] = v;
				return obj;
			}
			default:
				throw new Error(`Unsupported PHP serialized type '${type}' at offset ${this.pos}`);
		}
	}

	parseSession(): PhpSessionData {
		const data: PhpSessionData = {};
		while (this.pos < this.buf.length) {
			const sep = this.buf.indexOf("|", this.pos);
			if (sep < 0) throw new Error("Malformed PHP session data: missing '|'");
			const key = this.buf.toString("ascii", this.pos, sep);
			this.pos = sep + 1;
			data[key] = this.parseValue();
		}
		return data;
	}

	private expect(s: string): void {
		const actual = this.buf.toString("ascii", this.pos, this.pos + s.length);
		if (actual !== s) {
			throw new Error(`Malformed PHP serialized data at ${this.pos}: expected ${s}`);
		}
		this.pos += s.length;
	}

	private expectChar(c: string): void {
		this.expect(c);
	}

	private readUntil(delim: string): string {
		const end = this.buf.indexOf(delim, this.pos);
		if (end < 0) throw new Error("Malformed PHP serialized data: unterminated value");
		const s = this.buf.toString("ascii", this.pos, end + delim.length);
		this.pos = end + delim.length;
		return s;
	}
}

export function parsePhpSession(text: string | Buffer): PhpSessionData {
	const buf = typeof text === "string" ? Buffer.from(text, "utf8") : text;
	return new Parser(buf).parseSession();
}

const SESSION_ID = /^[A-Za-z0-9,-]{22,64}$/;

/**
 * Session store that reads and writes PHP-format session files
 * (`sess_<id>` in the configured session dir), so PHP satellite apps
 * (FileGator, the web-terminal auth shim) can read the panel's sessions
 * unchanged. The cookie carries the bare session id, as with PHP.
 *
 * Inactivity handling mirrors web/inc/main.php: LAST_ACTIVITY and
 * INACTIVE_SESSION_TIMEOUT live in the session record itself; an expired
 * session is destroyed on read.
 */
export class PhpSessionStore {
	constructor(private readonly config: HestiaConfig) {}

	private pathFor(id: string): string {
		if (!SESSION_ID.test(id)) {
			throw new Error(`Invalid session id: ${id}`);
		}
		return join(this.config.sessionDir, `sess_${id}`);
	}

	async create(data: PhpSessionData): Promise<string> {
		await mkdir(this.config.sessionDir, { recursive: true });
		const id = randomBytes(16).toString("hex");
		await writeFile(this.pathFor(id), serializePhpSession(data), {
			mode: 0o600,
		});
		return id;
	}

	async get(id: string): Promise<PhpSessionData | null> {
		// Validate before the try: a malformed id is a programming error
		// (and a path-traversal attempt), not a missing session.
		const path = this.pathFor(id);
		let data: PhpSessionData;
		try {
			data = parsePhpSession(await readFile(path));
		} catch {
			return null;
		}
		const now = Math.floor(Date.now() / 1000);
		const lastActivity = Number(data.LAST_ACTIVITY ?? 0);
		const timeout = Number(data.INACTIVE_SESSION_TIMEOUT ?? 0) || this.config.sessionTimeoutSeconds;
		if (lastActivity > 0 && now - lastActivity > timeout) {
			await this.destroy(id);
			return null;
		}
		data.LAST_ACTIVITY = now;
		await this.set(id, data);
		return data;
	}

	async set(id: string, data: PhpSessionData): Promise<void> {
		await mkdir(this.config.sessionDir, { recursive: true });
		await writeFile(this.pathFor(id), serializePhpSession(data), {
			mode: 0o600,
		});
	}

	async destroy(id: string): Promise<void> {
		if (!SESSION_ID.test(id)) return;
		await rm(this.pathFor(id), { force: true });
	}
}
