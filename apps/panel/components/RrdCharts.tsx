"use client";

import { useEffect, useRef } from "react";

/**
 * Client island for /list/rrd: a 1:1 port of web/js/src/rrdCharts.js.
 * Each graph fetches its series from /api/rrd and draws a Chart.js line
 * chart with the same options PHP uses (tension 0.3, no point markers,
 * legend at the bottom, axis colors from the theme's --chart-* variables).
 * Chart.js is imported dynamically, like PHP's separate chart bundle.
 */

export interface RrdGraph {
	title: string;
	service: string;
}

interface RrdData {
	data: number[][];
	meta: { start: number; step: number; legend: string[] };
	unit: string | null;
}

function getCssVariable(name: string): string {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function formatLabel(date: Date, period: string): string {
	const options: Record<string, Intl.DateTimeFormatOptions> = {
		daily: { hour: "2-digit", minute: "2-digit", hour12: false },
		weekly: { weekday: "short", day: "numeric" },
		monthly: { month: "short", day: "numeric" },
		yearly: { month: "long" },
		biennially: { month: "long", year: "numeric" },
		triennially: { month: "long", year: "numeric" },
	};
	return date.toLocaleString([], options[period] ?? options.daily);
}

function RrdChart({ title, service, period }: { title: string; service: string; period: string }) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	useEffect(() => {
		let chart: { destroy: () => void } | null = null;
		let cancelled = false;
		void (async () => {
			const { Chart } = await import("chart.js/auto");
			if (cancelled || !canvasRef.current) return;
			const res = await fetch("/api/rrd", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ service, period }),
			});
			if (!res.ok || cancelled || !canvasRef.current) return;
			const rrdData = (await res.json()) as RrdData;
			const labelColor = getCssVariable("--chart-label-color");
			const gridColor = getCssVariable("--chart-grid-color");
			chart = new Chart(canvasRef.current, {
				type: "line",
				data: {
					labels: rrdData.data.map((_point, index) =>
						formatLabel(new Date((rrdData.meta.start + index * rrdData.meta.step) * 1000), period),
					),
					datasets: rrdData.meta.legend.map((legend, legendIndex) => ({
						label: legend,
						data: rrdData.data.map((point) => point[legendIndex]),
						tension: 0.3,
						pointStyle: false,
						borderWidth: 2,
						borderColor: getCssVariable(`--chart-line-${legendIndex + 1}-color`) || undefined,
					})),
				},
				options: {
					plugins: {
						legend: { position: "bottom", labels: { color: labelColor } },
					},
					scales: {
						x: { ticks: { color: labelColor }, grid: { color: gridColor } },
						y: {
							title: {
								display: Boolean(rrdData.unit),
								text: rrdData.unit ?? "",
								color: labelColor,
							},
							ticks: { color: labelColor },
							grid: { color: gridColor },
						},
					},
				},
			});
		})();
		return () => {
			cancelled = true;
			chart?.destroy();
		};
	}, [service, period]);
	return (
		<div className="u-mb40">
			<h2 className="u-mb20">{title}</h2>
			<canvas
				ref={canvasRef}
				className="u-max-height300 js-rrd-chart"
				data-service={service}
				data-period={period}
			/>
		</div>
	);
}

export default function RrdCharts({ graphs, period }: { graphs: RrdGraph[]; period: string }) {
	return (
		<>
			{graphs.map((graph) => (
				<RrdChart key={graph.service} title={graph.title} service={graph.service} period={period} />
			))}
		</>
	);
}
