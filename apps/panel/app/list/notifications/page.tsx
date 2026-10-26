import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowActionButton } from "@/components/RowAction";
import { acknowledgeNotificationAction, deleteNotificationAction } from "./actions";

/**
 * Notifications: PHP has no full-page template for this (it renders
 * only the top-bar dropdown), so the Next list is kept as-is and
 * given PHP's acknowledge/delete operations. No footer, bulk, or
 * sort claims are invented for it.
 */
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserNotifications(user));
	const token = String(session.data.token ?? "");
	return (
		<ListView
			title={t("Notifications")}
			result={result}
			columns={[
				{ key: "TOPIC", label: t("Topic") },
				{ key: "NOTICE", label: t("Notice") },
				{ key: "TYPE", label: t("Type") },
				{ key: "ACK", label: t("Ack") },
				{ key: "DATE", label: t("Date") },
			]}
			rowActions={(key, row) => [
				...(row.ACK === "yes"
					? []
					: [
							<form
								key="acknowledge"
								action={acknowledgeNotificationAction}
								style={{ display: "inline" }}
							>
								<input type="hidden" name="token" value={token} />
								<input type="hidden" name="notice" value={key} />
								<RowActionButton title={t("Acknowledge")} icon="fa-check icon-green" />
							</form>,
						]),
				<form key="delete" action={deleteNotificationAction} style={{ display: "inline" }}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="notice" value={key} />
					<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
				</form>,
			]}
			containerId="list-notifications"
			chrome={{
				sortBy: t("Sort by"),
				search: t("Search"),
				applyToSelected: t("Apply to selected"),
				select: t("Select"),
				selectAll: t("Select all"),
			}}
		></ListView>
	);
}
