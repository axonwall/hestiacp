import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const result = await loadRows(() => hestia.listUserSshKeys(user));
	return (
		<ListView
			title={t("SSH Keys")}
			result={result}
			columns={[
				{ key: "ID", label: t("ID") },
				{ key: "KEY", label: t("Key"), format: (v) => (v.length > 32 ? `${v.slice(0, 32)}…` : v) },
			]}
		></ListView>
	);
}
