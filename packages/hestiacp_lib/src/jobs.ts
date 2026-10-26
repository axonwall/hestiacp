import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";

/**
 * A minimal file-backed job runner — the piece Phase 0's audit said
 * the WebApp installers need (PHP runs them synchronously in-request
 * with a 300s timeout; the Next.js panel must not hold a request open
 * that long). Jobs are detached promises whose state is persisted as
 * one JSON file per job so any panel process (or a page refresh) can
 * report status. Not a queue with workers: jobs run in the panel
 * process that started them, and a panel restart marks nothing —
 * records simply stay "running" if their process died, which the
 * jobs page shows honestly with the start time.
 */
export interface JobRecord {
	id: string;
	name: string;
	status: "running" | "done" | "failed";
	startedAt: string;
	finishedAt?: string;
	error?: string;
	meta?: Record<string, string>;
}

export class JobStore {
	constructor(private readonly dir: string) {}

	private path(id: string) {
		return join(this.dir, `${id}.json`);
	}

	async create(name: string, meta?: Record<string, string>): Promise<JobRecord> {
		await mkdir(this.dir, { recursive: true });
		const record: JobRecord = {
			id: randomBytes(8).toString("hex"),
			name,
			status: "running",
			startedAt: new Date().toISOString(),
			meta,
		};
		await writeFile(this.path(record.id), JSON.stringify(record, null, 2));
		return record;
	}

	async update(id: string, patch: Partial<JobRecord>): Promise<void> {
		const current = await this.get(id);
		if (!current) return;
		await writeFile(this.path(id), JSON.stringify({ ...current, ...patch }, null, 2));
	}

	async get(id: string): Promise<JobRecord | null> {
		try {
			return JSON.parse(await readFile(this.path(id), "utf8")) as JobRecord;
		} catch {
			return null;
		}
	}

	async list(): Promise<JobRecord[]> {
		let files: string[];
		try {
			files = await readdir(this.dir);
		} catch {
			return [];
		}
		const records: JobRecord[] = [];
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			const record = await this.get(file.slice(0, -5));
			if (record) records.push(record);
		}
		return records.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}
}

/**
 * Start a job: persist the running record, run fn detached, and mark
 * the outcome. Returns the record immediately.
 */
export async function startJob(
	store: JobStore,
	name: string,
	meta: Record<string, string> | undefined,
	fn: () => Promise<void>,
): Promise<JobRecord> {
	const record = await store.create(name, meta);
	void (async () => {
		try {
			await fn();
			await store.update(record.id, {
				status: "done",
				finishedAt: new Date().toISOString(),
			});
		} catch (error) {
			await store.update(record.id, {
				status: "failed",
				finishedAt: new Date().toISOString(),
				error: error instanceof Error ? error.message : String(error),
			});
		}
	})();
	return record;
}
