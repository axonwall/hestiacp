import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserNotifications(user));
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
		></ListView>
	);
}
