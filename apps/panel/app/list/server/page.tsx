import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
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
						<a href={`/edit/server/service?service=${encodeURIComponent(key)}`}>
							{t("Config")}
						</a>{" "}
						{row.STATE === "running" ? (
							<>
								<form action={serviceControlAction} style={{ display: "inline" }}>
									<input type="hidden" name="token" value={token} />
									<input type="hidden" name="service" value={key} />
									<input type="hidden" name="op" value="restart" />
									<button type="submit" className="link-button">
										{t("Restart")}
									</button>
								</form>{" "}
								<form action={serviceControlAction} style={{ display: "inline" }}>
									<input type="hidden" name="token" value={token} />
									<input type="hidden" name="service" value={key} />
									<input type="hidden" name="op" value="stop" />
									<button type="submit" className="link-button">
										{t("Stop")}
									</button>
								</form>
							</>
						) : (
							<form action={serviceControlAction} style={{ display: "inline" }}>
								<input type="hidden" name="token" value={token} />
								<input type="hidden" name="service" value={key} />
								<input type="hidden" name="op" value="start" />
								<button type="submit" className="link-button">
									{t("Start")}
								</button>
							</form>
						)}
					</>
				)}
			>
				<a href="/edit/server">{t("Server settings")}</a>
			</ListView>
		</div>
	);
}
