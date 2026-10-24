import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";

export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const result = await loadRows(() => hestia.listSysIps());
	return (
		<ListView
			title={t("IP Addresses")}
			result={result}
			columns={[
				{ key: "IP", label: t("IP") },
				{ key: "NETMASK", label: t("Netmask") },
				{ key: "INTERFACE", label: t("Interface") },
				{ key: "OWNER", label: t("Owner") },
				{ key: "STATUS", label: t("Status") },
				{ key: "NAME", label: t("Name") },
				{ key: "NAT", label: t("NAT") },
			]}
			rowActions={(key) => (
				<>
					<RowAction href={`/edit/ip?ip=${encodeURIComponent(key)}`} title={t("Edit")} icon="fa-pencil icon-orange" />
					<RowAction href={`/delete/ip?ip=${encodeURIComponent(key)}`} title={t("Delete")} icon="fa-trash icon-red" />
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/ip"><i className="fas fa-circle-plus icon-green"></i>{t("Add IP address")}</Link>
		</ListView>
	);
}
