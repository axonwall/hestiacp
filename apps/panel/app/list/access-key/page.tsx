import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { bulkAccessKeyAction, deleteAccessKeyAction } from "./actions";

/**
 * Access keys (web/templates/pages/list_access_keys.php). The heading
 * links to the key-detail view, and the toolbar carries the Add Access
 * Key button, as in PHP.
 */
export default async function Page({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listAccessKeys(user));
	const token = String(session.data.token ?? "");
	const { sort } = await searchParams;
	const bold = (v: string) => <span className="u-text-bold">{v || "-"}</span>;
	return (
		<ListView
			title={t("Access Keys")}
			result={result}
			columns={[
				{ key: "ACCESS_KEY_ID", label: t("Access Key") },
				{ key: "COMMENT", label: t("Comment"), center: true, format: bold },
				{ key: "DATE", label: t("Date"), center: true, format: bold },
				{ key: "TIME", label: t("Time"), center: true, format: bold },
			]}
			rowHref={(key) => `/list/access-key/${encodeURIComponent(key)}`}
			rowActions={(key) => [
				<form key="delete" action={deleteAccessKeyAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="key" value={key} />
					<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
				</form>,
			]}
			footer={{ singular: t("access key"), plural: t("access keys") }}
			checkboxName="key[]"
			bulkAction={bulkAccessKeyAction}
			bulkToken={token}
			bulkOptions={[{ value: "delete", label: t("Delete") }]}
			sort={sort}
			sortBase="/list/access-key"
			sortOptions={[
				{
					key: "date",
					label: t("Date"),
					value: (_k, row) => Date.parse(`${row.DATE ?? ""}T${row.TIME ?? ""}`) || 0,
					dir: "desc",
				},
				{
					key: "key",
					label: t("Access Key"),
					value: (k) => k.toLowerCase(),
					dir: "asc",
				},
				{
					key: "comment",
					label: t("Comment"),
					value: (_k, row) => (row.COMMENT || "-").toLowerCase(),
					dir: "asc",
				},
			]}
			containerId="list-access-key"
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
			<Link className="button button-secondary js-button-create" href="/add/access-key">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Access Key")}
			</Link>
		</ListView>
	);
}
