import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";

/**
 * Server overview (admin): the v-list-sys-info record as a summary card
 * plus the services table (v-list-sys-services) — PHP's /list/server/.
 */
export default async function Page() {
	await requireAdmin();
	const t = await getT();
	const [info, services] = await Promise.all([
		hestia.listSysInfo().catch(() => null),
		loadRows(() => hestia.listSysServices()),
	]);
	return (
		<div>
			{info ? (
				<div className="card">
					<h1>
						{info.HOSTNAME} — {info.OS} {info.OS_VERSION}
					</h1>
					<p>
						Hestia {info.VERSION} ({info.RELEASE}) · CPU {info.CPU} ·{" "}
						{t("Memory")} {info.MEM} MB · Load {info.LOADAVERAGE}
					</p>
				</div>
			) : null}
			<ListView
				title={t("Services")}
				result={services}
				columns={[
					{ key: "SERVICE", label: t("Services") },
					{ key: "STATE", label: t("Status") },
					{ key: "CPU", label: "CPU %" },
					{ key: "MEM", label: `${t("Memory")} MB` },
				]}
			/>
		</div>
	);
}
