import Link from "next/link";
import type { HestiaRow } from "@hestiacp/lib";

export interface ListColumn {
	key: string;
	label: string;
	/** Optional cell formatter; receives the raw value and the whole row. */
	format?: (value: string, row: HestiaRow) => string;
}

export type RowsResult =
	| { rows: Record<string, HestiaRow> }
	| { error: string };

/**
 * Shared read-only table for the Phase 2 list views — the shape every
 * PHP list template shares: a title, a grid of the v-list-* fields, an
 * empty state, and an error state when the command layer is unreachable.
 * The first column links via rowHref when given (e.g. a DNS domain to
 * its records).
 */
export function ListView({
	title,
	columns,
	result,
	emptyText = "Nothing here yet.",
	rowHref,
	rowActions,
	children,
}: {
	title: string;
	columns: ListColumn[];
	result: RowsResult;
	emptyText?: string;
	rowHref?: (key: string, row: HestiaRow) => string;
	/** Optional per-row action cell (edit links, suspend toggles, deletes). */
	rowActions?: (key: string, row: HestiaRow) => React.ReactNode;
	children?: React.ReactNode;
}) {
	if ("error" in result) {
		return (
			<div className="card">
				<h1>{title}</h1>
				<p className="error">
					Could not reach the Hestia command layer: {result.error}
				</p>
			</div>
		);
	}
	const entries = Object.entries(result.rows);
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<h1 className="list-title">{title}</h1>
					<div className="toolbar-buttons">{children}</div>
				</div>
			</div>
			{entries.length === 0 ? (
				<div className="container">
					<p>{emptyText}</p>
				</div>
			) : (
				<div className="units-table">
					<div className="units-table-header">
						{columns.map((col) => (
							<div className="units-table-cell" key={col.key}>
								{col.label}
							</div>
						))}
						{rowActions ? <div className="units-table-cell">Actions</div> : null}
					</div>
					{entries.map(([key, row]) => (
						<div
							className={`units-table-row${row.SUSPENDED === "yes" ? " disabled" : ""}`}
							key={key}
						>
							{columns.map((col, i) => {
								const raw = row[col.key] ?? "";
								const text = col.format ? col.format(raw, row) : raw;
								return (
									<div className="units-table-cell" key={col.key}>
										{i === 0 && rowHref ? (
											<Link href={rowHref(key, row)}>{text}</Link>
										) : (
											text
										)}
									</div>
								);
							})}
							{rowActions ? (
								<div className="units-table-cell">
									<div className="units-table-row-actions">{rowActions(key, row)}</div>
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
