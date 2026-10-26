import Link from "next/link";
import { humanizeTime } from "@hestiacp/lib";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import ConfirmLink from "@/components/ConfirmLink";
import { bulkServiceAction, serviceControlAction } from "./actions";

/**
 * Server overview (admin): the v-list-sys-info record as a summary
 * card plus the services table (web/templates/pages/list_services.php).
 * The Next-only sysinfo card above the table is kept. The Restart
 * button confirms via a native dialog (PHP uses a styled dialog;
 * the panel has no modal infrastructure).
 */
export default async function Page() {
	const session = await requireAdmin();
	const t = await getT();
	const token = String(session.data.token ?? "");
	const firewallOn = session.data.FIREWALL_SYSTEM === "iptables";
	const [info, services] = await Promise.all([
		hestia.listSysInfo().catch(() => null),
		loadRows(() => hestia.listSysServices()),
	]);
	const cpu = (v: string) => {
		const c = Number(v) / 10;
		// PHP: number_format($cpu, 1), then "0.0" becomes 0.
		if (!Number.isFinite(c)) return "0";
		const formatted = c.toFixed(1);
		return formatted === "0.0" ? "0" : formatted;
	};
	const toggleForm = (key: string, row: Record<string, string>) =>
		row.STATE === "running" ? (
			<form key="toggle" action={serviceControlAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="service" value={key} />
				<input type="hidden" name="op" value="stop" />
				<RowActionButton title={t("Stop")} icon="fa-stop icon-red" />
			</form>
		) : (
			<form key="toggle" action={serviceControlAction} style={{ display: "inline" }}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="service" value={key} />
				<input type="hidden" name="op" value="start" />
				<RowActionButton title={t("Start")} icon="fa-play icon-green" />
			</form>
		);
	return (
		<div>
			{info ? (
				<div className="card">
					<h1>
						{info.HOSTNAME} — {info.OS} {info.VERSION}
					</h1>
					<p>
						Hestia {info.HESTIA} ({info.RELEASE}) · Load {info.LOADAVERAGE}
					</p>
				</div>
			) : null}
			<ListView
				title={t("Services")}
				result={services}
				columns={[
					{
						key: "SERVICE",
						label: t("Service"),
						format: (v, row) => (
							<>
								<i
									className={`fas ${row.STATE === "running" ? "fa-circle-check icon-green" : "fa-circle-minus icon-red"} u-mr5`}
								></i>{" "}
								{v}
							</>
						),
					},
					{
						key: "SYSTEM",
						label: t("Description"),
						format: (v) => t(v),
					},
					{
						key: "RTIME",
						label: t("Uptime"),
						center: true,
						format: (v) => <span className="u-text-bold">{humanizeTime(v, t)}</span>,
					},
					{
						key: "CPU",
						label: t("CPU"),
						center: true,
						format: (v) => <span className="u-text-bold">{cpu(v)}</span>,
					},
					{
						key: "MEM",
						label: t("Memory"),
						center: true,
						format: (v) => (
							<span className="u-text-bold">
								{v} {t("MB")}
							</span>
						),
					},
				]}
				rowHref={(key) => `/edit/server/service?service=${encodeURIComponent(key)}`}
				rowActions={(key, row) => [
					<RowAction
						key="edit"
						href={`/edit/server/service?service=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>,
					<form key="restart" action={serviceControlAction} style={{ display: "inline" }}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="service" value={key} />
						<input type="hidden" name="op" value="restart" />
						<RowActionButton title={t("Restart")} icon="fa-arrow-rotate-left icon-highlight" />
					</form>,
					toggleForm(key, row),
				]}
				checkboxName="service[]"
				bulkAction={bulkServiceAction}
				bulkToken={token}
				bulkOptions={[
					{ value: "stop", label: t("Stop") },
					{ value: "start", label: t("Start") },
					{ value: "restart", label: t("Restart") },
				]}
				containerId="list-server"
				search={false}
				chrome={{
					sortBy: t("Sort by"),
					search: t("Search"),
					applyToSelected: t("Apply to selected"),
					select: t("Select"),
					selectAll: t("Select all"),
				}}
			>
				<Link className="button button-secondary" href="/edit/server">
					<i className="fas fa-gear icon-maroon"></i>
					{t("Configure")}
				</Link>
				<Link className="button button-secondary" href="/list/rrd">
					<i className="fas fa-chart-area icon-blue"></i>
					{t("Task Monitor")}
				</Link>
				<Link className="button button-secondary" href="/list/updates">
					<i className="fas fa-arrows-rotate icon-green"></i>
					{t("Updates")}
				</Link>
				{firewallOn ? (
					<Link className="button button-secondary" href="/list/firewall">
						<i className="fas fa-shield-halved icon-red"></i>
						{t("Firewall")}
					</Link>
				) : null}
				<Link className="button button-secondary" href="/list/log?user=system">
					<i className="fas fa-binoculars icon-orange"></i>
					{t("Logs")}
				</Link>
				{info?.HOSTNAME ? (
					<ConfirmLink
						className="button button-secondary button-danger"
						href={`/restart/system?hostname=${encodeURIComponent(info.HOSTNAME)}&token=${encodeURIComponent(token)}&system_reset_token=${Math.floor(Date.now() / 1000)}`}
						title={t("Restart")}
						message={t("Are you sure you want to restart the server?")}
					>
						<i className="fas fa-arrow-rotate-left icon-red"></i>
						{t("Restart")}
					</ConfirmLink>
				) : null}
			</ListView>
		</div>
	);
}
