import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { toggleAutoupdateAction } from "./actions";

/**
 * Updates (web/templates/pages/list_updates.php): no checkbox, no
 * row actions, no footer, no sort, no search. Outdated rows render
 * dimmed (PHP's "disabled" class). Status is icon-only with a title,
 * as in PHP.
 */
export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysHestiaUpdates());
	const token = String(session.data.token ?? "");
	const autoupdate = await hestia.sysHestiaAutoupdate().catch(() => "");
	const enabled = autoupdate.trim() === "Enabled";
	return (
		<ListView
			title={t("Updates")}
			result={result}
			columns={[
				{ key: "PACKAGE", label: t("Package Names") },
				{ key: "DESCR", label: t("Description"), format: (v) => t(v) },
				{
					key: "VERSION",
					label: t("Version"),
					center: true,
					format: (v, row) => `${v} (${row.ARCH})`,
				},
				{
					key: "UPDATED",
					label: t("Status"),
					center: true,
					format: (v) =>
						v === "no" ? (
							<i
								className="fas fa-triangle-exclamation icon-orange"
								title={t("Update available")}
							></i>
						) : (
							<i className="fas fa-circle-check icon-green" title={t("Package up-to-date")}></i>
						),
				},
			]}
			isDisabled={(_key, row) => row.UPDATED !== "yes"}
			containerId="list-updates"
			search={false}
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/list/server">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
			<form action={toggleAutoupdateAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="op" value={enabled ? "disable" : "enable"} />
				<button type="submit" className="button button-secondary">
					<i
						className={`fas ${enabled ? "fa-toggle-on icon-green" : "fa-toggle-off icon-red"}`}
					></i>
					{enabled ? t("Disable Automatic Updates") : t("Enable Automatic Updates")}
				</button>
			</form>
		</ListView>
	);
}
