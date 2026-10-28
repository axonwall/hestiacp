import Link from "next/link";
import { RRD_PERIODS } from "@hestiacp/lib";
import RrdCharts from "@/components/RrdCharts";
import { getT, hestia, loadRows, requireAdmin } from "@/lib/panel";

const PERIOD_LABELS: Record<string, string> = {
	daily: "Daily",
	weekly: "Weekly",
	monthly: "Monthly",
	yearly: "Yearly",
	biennially: "Biennially",
	triennially: "Triennially",
};

export default async function RrdPage({
	searchParams,
}: {
	searchParams: Promise<{ period?: string }>;
}) {
	await requireAdmin();
	const query = await searchParams;
	const t = await getT();
	const period = (RRD_PERIODS as readonly string[]).includes(query.period ?? "")
		? (query.period as string)
		: "daily";
	const result = await loadRows(() => hestia.listSysRrd());
	if ("error" in result) {
		return (
			<div>
				<p className="error">{result.error}</p>
			</div>
		);
	}
	const graphs = Object.values(result.rows).map((row) => ({
		title: row.TITLE ?? "",
		// PHP: TYPE "net" charts are named net_<interface>.
		service: row.TYPE !== "net" ? (row.RRD ?? "") : `net_${row.RRD ?? ""}`,
	}));
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<div className="toolbar-buttons">
						<Link
							className="button button-secondary button-back js-button-back"
							href="/list/server/"
						>
							<i className="fas fa-arrow-left icon-blue"></i>
							{t("Back")}
						</Link>
						<Link href="/list/server/?cpu" className="button button-secondary">
							<i className="fas fa-chart-pie icon-green"></i>
							{t("Advanced Details")}
						</Link>
					</div>
					<div className="toolbar-right">
						{RRD_PERIODS.map((p) => (
							<Link
								key={p}
								className={`toolbar-link${p === period ? " selected" : ""}`}
								href={`/list/rrd?period=${p}`}
							>
								{t(PERIOD_LABELS[p])}
							</Link>
						))}
					</div>
				</div>
			</div>
			<div className="container">
				<div className="form-container form-container-wide">
					<RrdCharts graphs={graphs} period={period} />
				</div>
			</div>
		</div>
	);
}
