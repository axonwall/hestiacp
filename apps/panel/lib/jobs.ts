import { JobStore } from "@hestiacp/lib";

/**
 * Where background-job records live. In production this sits next to
 * the session directory on the Hestia data volume; locally it
 * defaults to a tmp folder.
 */
export function jobStore(): JobStore {
	return new JobStore(process.env.HESTIA_JOB_DIR ?? "/tmp/hestiang-jobs");
}
