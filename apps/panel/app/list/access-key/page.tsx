import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { bulkAccessKeyAction, deleteAccessKeyAction } from "./actions";

/**
 * Access keys (web/templates/pages/list_access_keys.php). The heading
 * is deliberately NOT linked: PHP links it to the key-detail view
 * (/list/access-key/?key=…), which Next does not have yet, so a link
 * would 404. Likewise the Add Access Key toolbar button is omitted
 * until /add/access-key exists.
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
			rowActions={(key) => [
				<form action={deleteAccessKeyAction} style={{ display: "inline" }}>
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
		</ListView>
	);
}
