import Link from "next/link";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { serviceControlAction } from "./actions";

/**
 * Server overview (admin): the v-list-sys-info record as a summary card
 * plus the services table (v-list-sys-services) — PHP's /list/server/.
 */
export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const token = String(session.data.token ?? "");
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
				rowActions={(key, row) => (
					<>
						<RowAction href={`/edit/server/service?service=${encodeURIComponent(key)}`} title={t("Config")} icon="fa-gear icon-maroon" />{" "}
						{row.STATE === "running" ? (
							<>
								<form action={serviceControlAction} style={{ display: "inline" }}>
									<input type="hidden" name="token" value={token} />
									<input type="hidden" name="service" value={key} />
									<input type="hidden" name="op" value="restart" />
									<RowActionButton title={t("Restart")} icon="fa-arrow-rotate-left icon-red" />
								</form>
								<form action={serviceControlAction} style={{ display: "inline" }}>
									<input type="hidden" name="token" value={token} />
									<input type="hidden" name="service" value={key} />
									<input type="hidden" name="op" value="stop" />
									<RowActionButton title={t("Stop")} icon="fa-stop icon-red" />
								</form>
							</>
						) : (
							<form action={serviceControlAction} style={{ display: "inline" }}>
								<input type="hidden" name="token" value={token} />
								<input type="hidden" name="service" value={key} />
								<input type="hidden" name="op" value="start" />
								<RowActionButton title={t("Start")} icon="fa-play icon-green" />
							</form>
						)}
					</>
				)}
			>
				<Link className="button button-secondary" href="/edit/server">{t("Server settings")}</Link>
			</ListView>
		</div>
	);
}
