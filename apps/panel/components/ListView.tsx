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
			<h1>{title}</h1>
			{children}
			{entries.length === 0 ? (
				<p>{emptyText}</p>
			) : (
				<table className="grid">
					<thead>
						<tr>
							{columns.map((col) => (
								<th key={col.key}>{col.label}</th>
							))}
							{rowActions ? <th>Actions</th> : null}
						</tr>
					</thead>
					<tbody>
						{entries.map(([key, row]) => (
							<tr key={key}>
								{columns.map((col, i) => {
									const raw = row[col.key] ?? "";
									const text = col.format ? col.format(raw, row) : raw;
									return (
										<td key={col.key}>
											{i === 0 && rowHref ? (
												<Link href={rowHref(key, row)}>{text}</Link>
											) : (
												text
											)}
										</td>
									);
								})}
								{rowActions ? <td>{rowActions(key, row)}</td> : null}
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}
