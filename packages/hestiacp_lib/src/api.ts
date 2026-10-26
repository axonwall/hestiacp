import { writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { HestiaClient } from "./client";

/**
 * The legacy HestiaCP API (web/api/index.php), reimplemented as a pure
 * dispatcher so the panel's /api route is a thin adapter and the semantics
 * are unit-testable against fixtures. Behaviour mirrors the PHP original:
 *
 *  - Two auth flows: legacy (hash, or user+password for the ROOT_USER only)
 *    and access-key (v-check-access-key authenticates and authorizes).
 *  - Gates, in order: API enabled in sys config, API_ALLOWED_IP allowlist,
 *    authentication, command-name validation, dispatch.
 *  - `v-make-tmp-file` is implemented in-process (writes arg1 to
 *    /tmp/<basename(arg2)>) — DNS clustering depends on it; it never
 *    reaches the command layer.
 *  - Responses carry the Hestia exit code; the HTTP status comes from the
 *    same exit_code_to_http_code() mapping helpers.php uses, and with
 *    returncode=yes the body is the exit code itself instead of the output.
 */

// Hestia error codes (web/inc/helpers.php).
export const E_ARGS = 1;
export const E_INVALID = 2;
export const E_PASSWORD = 9;
export const E_FORBIDDEN = 10;
export const E_DISABLED = 11;
export const E_API_DISABLED = 21;

export function exitCodeToHttpCode(exitCode: number): number {
	switch (exitCode) {
		case 0:
			return 200;
		case E_ARGS:
			return 400;
		case E_INVALID:
			return 422;
		case E_PASSWORD:
		case 5: // E_SUSPENDED
		case 6: // E_UNSUSPENDED
		case E_FORBIDDEN:
		case E_API_DISABLED:
			return 401;
		case E_DISABLED:
			return 400;
		default:
			return 400;
	}
}

export type ApiRequestData = Record<string, string | undefined>;

export interface ApiResult {
	httpStatus: number;
	exitCode: number;
	body: string;
}

const COMMAND_PATTERN = /^[a-zA-Z0-9_-]+$/;

function collectArgs(data: ApiRequestData): string[] {
	const args: string[] = [];
	for (let i = 1; i <= 13; i++) {
		const v = data[`arg${i}`];
		if (v === undefined) break;
		args.push(v.trim());
	}
	return args;
}

export async function handleApiRequest(
	client: HestiaClient,
	data: ApiRequestData,
	ip: string,
): Promise<ApiResult> {
	const returnCode = data.returncode === "yes";
	const fail = (exitCode: number, message: string): ApiResult => ({
		httpStatus: exitCodeToHttpCode(exitCode),
		exitCode,
		body: returnCode
			? String(exitCode)
			: message.startsWith("Error:")
				? message
				: `Error: ${message}`,
	});

	const sys = await client.listSysConfig();
	const config = sys.config ?? {};
	const rootUser = config.ROOT_USER ?? "admin";

	const cmd = (data.cmd ?? "").trim();
	const args = collectArgs(data);

	const dispatch = async (flow: "legacy" | "accesskey"): Promise<ApiResult> => {
		if (!cmd) return fail(E_INVALID, "Command not provided");
		if (!COMMAND_PATTERN.test(cmd)) {
			return fail(E_INVALID, `${cmd} command invalid`);
		}
		if (cmd === "v-make-tmp-file") {
			// Implemented in-process by the PHP API for DNS clustering:
			// write arg1 to /tmp/<basename(arg2)>. The basename call is the
			// only thing standing between arg2 and path traversal — keep it.
			const name = basename(args[1] ?? "");
			if (!name) return fail(E_INVALID, "v-make-tmp-file: missing file name");
			await writeFile(join("/tmp", name), `${args[0] ?? ""}\n`);
			if (returnCode) return { httpStatus: 200, exitCode: 0, body: "0" };
			// Silent success: legacy answers "OK", the access-key flow
			// answers 204 with an empty body (see below).
			return flow === "legacy"
				? { httpStatus: 200, exitCode: 0, body: "OK" }
				: { httpStatus: 204, exitCode: 0, body: "" };
		}
		const result = await client.raw(cmd, ...args);
		if (returnCode) {
			return { httpStatus: 200, exitCode: result.code, body: String(result.code) };
		}
		if (flow === "legacy") {
			// api_legacy's tail: HTTP is always 200 for a dispatched
			// command; a silent success answers "OK"; anything else is
			// the command's stdout with a trailing newline.
			const body =
				result.code === 0 && result.stdout === ""
					? "OK"
					: result.stdout === "" || result.stdout.endsWith("\n")
						? result.stdout
						: `${result.stdout}\n`;
			return { httpStatus: 200, exitCode: result.code, body };
		}
		// api_connection's tail: body is the TRIMMED output; a silent
		// success is 204 No Content; failures take the mapped HTTP code.
		const body = result.stdout.trim();
		return {
			httpStatus: result.code > 0 ? exitCodeToHttpCode(result.code) : body === "" ? 204 : 200,
			exitCode: result.code,
			body,
		};
	};

	const ipAllowed = (): boolean => {
		const allowed = config.API_ALLOWED_IP ?? "allow-all";
		if (allowed === "allow-all") return true;
		return allowed
			.split(",")
			.map((s) => s.trim())
			.includes(ip);
	};

	// PHP compatibility: an access key may arrive embedded in the
	// `hash` field as "<20-char id>:<40-char secret>" (exactly one
	// colon) — api/index.php splits it into the access-key flow
	// before dispatch. Legacy API hashes never match this shape.
	if (data.access_key === undefined && data.hash) {
		const parts = data.hash.split(":");
		if (parts.length === 2 && parts[0].length === 20 && parts[1].length === 40) {
			data.access_key = parts[0];
			data.secret_key = parts[1];
			delete data.hash;
		}
	}

	if (data.access_key !== undefined || data.secret_key !== undefined) {
		// ---- Access-key flow (api_connection) ----
		const apiStatus = Number(config.API_SYSTEM ?? 0) || 0;
		if (apiStatus === 0) return fail(E_DISABLED, "API has been disabled");
		if (!ipAllowed()) {
			return fail(E_FORBIDDEN, "IP is not allowed to connect with API");
		}
		const keyId = (data.access_key ?? "").trim();
		const secretKey = (data.secret_key ?? "").trim();
		if (!keyId || !secretKey) {
			return fail(E_INVALID, "Access key and secret key are required");
		}
		if (!cmd || !COMMAND_PATTERN.test(cmd)) {
			return !cmd
				? fail(E_INVALID, "Command not provided")
				: fail(E_INVALID, `${cmd} command invalid`);
		}
		const check = await client.raw("v-check-access-key", keyId, secretKey, cmd, ip, "json");
		if (check.code !== 0) {
			// PHP passes v-check-access-key's stdout through as the
			// error message (its errors proper go to stderr, so this
			// is usually empty — the body is then just "Error:").
			return fail(check.code, check.stdout.trim());
		}
		let keyData: { USER?: string; USER_ARG_POSITION?: string };
		try {
			keyData = JSON.parse(check.stdout);
		} catch {
			return fail(E_INVALID, "authentication failed");
		}
		const keyUser = keyData.USER ?? "";
		if (keyUser !== rootUser && apiStatus < 2) {
			return fail(E_API_DISABLED, "API has been disabled");
		}
		const userArgPosition = Number(keyData.USER_ARG_POSITION ?? 0) || 0;
		if (keyUser !== rootUser && userArgPosition > 0) {
			if (args[userArgPosition - 1] !== keyUser) {
				return fail(E_FORBIDDEN, `Key ${keyId} - the "user" argument doesn't match the key's user`);
			}
		}
		return dispatch("accesskey");
	}

	// ---- Legacy flow (api_legacy): hash, or user+password for root ----
	if (config.API !== "yes") return fail(E_DISABLED, "API Disabled");
	if (!ipAllowed()) {
		return fail(E_FORBIDDEN, "IP is not allowed to connect with API");
	}
	if (data.hash) {
		// Hash-alone flow: the hash names a key file in data/keys/
		// and is checked by v-check-api-key — NOT against the user's
		// password hash (that conflation passed every fixture test
		// and failed the first real api.bats run).
		const ok = await client.checkApiKey(data.hash, ip);
		if (!ok) return fail(E_PASSWORD, "authentication failed");
	} else {
		if (data.user !== rootUser) {
			return fail(E_FORBIDDEN, "authentication failed");
		}
		const ok = await client.verifyUserPassword(rootUser, data.password ?? "", ip);
		if (!ok) return fail(E_PASSWORD, "authentication failed");
	}
	return dispatch("legacy");
}
