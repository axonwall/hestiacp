import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { deleteSshKeyAction } from "./actions";

/**
 * SSH keys (web/templates/pages/list_key.php): no checkbox, no sort,
 * no search. The key is shown in full and bold — the old page
 * truncated it at 32 chars. PHP hides the filemanager system key
 * (display:none); it is filtered out here instead, so it cannot be
 * deleted from this list. The Add SSH Key button is omitted until
 * /add/key exists.
 */
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(async () => {
		const rows = await hestia.listUserSshKeys(user);
		for (const key of Object.keys(rows)) {
			if (rows[key]?.ID === "filemanager.ssh.key") delete rows[key];
		}
		return rows;
	});
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("SSH Keys")}
			result={result}
			columns={[
				{ key: "ID", label: t("SSH ID") },
				{
					key: "KEY",
					label: t("SSH Key"),
					format: (v) => <span className="u-text-bold">{v}</span>,
				},
			]}
			rowActions={(key) => [
				<form action={deleteSshKeyAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="key" value={key} />
					<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
				</form>,
			]}
			footer={{ singular: t("SSH key"), plural: t("SSH keys") }}
			containerId="list-key"
			search={false}
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		>
			<Link className="button button-secondary" href="/edit/user">
				<i className="fas fa-arrow-left icon-blue"></i>
				{t("Back")}
			</Link>
		</ListView>
	);
}
