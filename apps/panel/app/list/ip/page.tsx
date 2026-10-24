import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";

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
					<Link href={`/edit/ip?ip=${encodeURIComponent(key)}`}>{t("Edit")}</Link>{" "}
					<Link href={`/delete/ip?ip=${encodeURIComponent(key)}`}>{t("Delete")}</Link>
				</>
			)}
		>
			<Link href="/add/ip">{t("Add IP address")}</Link>
		</ListView>
	);
}
