import { redirect } from "next/navigation";

/**
 * The file manager is FileGator under /fm/ — it authenticates off the
 * same PHP-format session files this panel writes (Phase 0 audit), so
 * the list/files entry point is a straight redirect, as in PHP.
 */
export default function Page() {
	redirect("/fm/");
}
