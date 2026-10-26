import { execFile } from "node:child_process";
import { join } from "node:path";
import type { HestiaConfig } from "./config";

export interface CommandResult {
	code: number;
	stdout: string;
	stderr: string;
}

const COMMAND_PATTERN = /^v-[a-z0-9][a-z0-9-]*$/;

/**
 * Run one v-* command. This is the single choke point through which every
 * panel action reaches the system — the TypeScript analogue of the PHP
 * panel's HESTIA_CMD + quoteshellarg discipline:
 *
 *  - execFile with an argv array: no shell is ever involved, so argument
 *    values cannot break out into shell syntax.
 *  - the command name is validated against the v-* pattern and resolved
 *    inside the configured bin directory only.
 *  - when sudo is enabled it is `sudo <abs path> <args...>`, matching the
 *    existing sudoers rule (hestiaweb ALL=NOPASSWD: /usr/local/hestia/bin/*).
 */
export function runHestiaCommand(
	config: HestiaConfig,
	command: string,
	args: string[],
): Promise<CommandResult> {
	if (!COMMAND_PATTERN.test(command)) {
		return Promise.reject(new Error(`Invalid Hestia command name: ${command}`));
	}
	const binPath = join(config.binDir, command);
	const file = config.useSudo ? "sudo" : binPath;
	const argv = config.useSudo ? [binPath, ...args] : args;
	return new Promise((resolve, reject) => {
		execFile(
			file,
			argv,
			{ timeout: 30_000, maxBuffer: 16 * 1024 * 1024, encoding: "utf8" },
			(error, stdout, stderr) => {
				if (error && typeof error.code !== "number") {
					// Spawn failure (missing binary, EACCES, timeout kill) — not a
					// Hestia exit code. Surface it as an exception, not a result.
					reject(new Error(`Failed to run ${command}: ${error.message}`));
					return;
				}
				resolve({
					code: error ? (error.code as number) : 0,
					stdout: stdout ?? "",
					stderr: stderr ?? "",
				});
			},
		);
	});
}
