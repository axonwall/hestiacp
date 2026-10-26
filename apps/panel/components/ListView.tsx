import Link from "next/link";
import type { HestiaRow } from "@hestiacp/lib";
import { BulkActions, SelectAllCheckbox } from "./ListBulk";

export interface ListColumn {
	key: string;
	label: string;
	/** Optional cell formatter; receives the raw value, the whole row, and the row key. */
	format?: (value: string, row: HestiaRow, key: string) => React.ReactNode;
	/** Center this column on desktop (PHP's u-text-center-desktop). */
	center?: boolean;
	/** Bold heading-cell styling on a non-first column (PHP's firewall Action cell). */
	heading?: boolean;
}

export interface SortOption {
	key: string;
	label: string;
	value: (key: string, row: HestiaRow) => string | number;
	dir?: "asc" | "desc";
}

/** Shared sort-value helpers (PHP's data-sort-* attributes, same semantics). */
export const sortByName = (key: string): string => key;
export const sortByDate = (_key: string, row: HestiaRow): string =>
	`${row.DATE ?? ""} ${row.TIME ?? ""}`;
export const sortByExpire = (_key: string, row: HestiaRow): string => row.EXP ?? "";
export const sortByRecords = (_key: string, row: HestiaRow): number => Number(row.RECORDS ?? 0);
export const sortByIp = (_key: string, row: HestiaRow): number =>
	Number(String(row.IP ?? "").replaceAll(".", "")) || 0;

/** Shared enabled/disabled status icon (PHP list templates). A
 * suspended row shows the plain icon; an active row colors it
 * green (enabled) or red (disabled). */
export function statusIcon(
	value: string,
	suspended: boolean,
	enabledTitle: string,
	disabledTitle: string,
) {
	const enabled = value === "yes";
	const icon = enabled ? "fa-circle-check" : "fa-circle-xmark";
	const color = suspended ? "" : enabled ? " icon-green" : " icon-red";
	return <i className={`fas ${icon}${color}`} title={enabled ? enabledTitle : disabledTitle}></i>;
}

export interface BulkOption {
	value: string;
	label: string;
}

export interface ListChrome {
	sortBy?: string;
	search?: string;
	applyToSelected?: string;
	select?: string;
	selectAll?: string;
}

export type RowsResult = { rows: Record<string, HestiaRow> } | { error: string };

/**
 * Shared table for the list views — the shape every PHP list template
 * shares: toolbar (buttons left, sorting + bulk + search right),
 * container, units-table with checkbox column, heading first column,
 * mobile labels, row actions as a <ul>, and a footer count.
 *
 * First-column rule: the v-list-* JSON objects are keyed by the object
 * name (domain, IP, backup file, ...) but most of them do NOT repeat
 * that name as a field inside the row — v-list-dns-domains rows carry
 * IP/TPL/TTL/... with no DOMAIN, v-list-sys-ips rows no IP, and so on.
 * So an empty first-column field falls back to the row key, which is
 * the object's name in every list. Without this the name column
 * renders as an empty link (found live 2026-10-25: /list/dns showed
 * rows with no visible domain name, because the fixtures wrongly
 * included the key as a field and masked it).
 *
 * Sorting is server-side via ?sort=<key> (no client JS in PHP's
 * place: PHP sorts with main.js over data-sort-* attributes; the
 * server-side sort covers the same keys). Bulk actions run through a
 * small client island that gathers the checked rows and calls the
 * page's server action — the suspend-toggle forms inside rows must
 * NOT be nested in a wrapping bulk <form> (nested forms submit to
 * the outer form), so there is no wrapping form element.
 *
 * Deliberate deviation: the toolbar keeps Next's h1.list-title.
 * PHP list pages show no desktop title (the section tab carries it);
 * the small styled title is kept as a navigation aid.
 */
export function ListView({
	title,
	columns,
	result,
	emptyText = "Nothing here yet.",
	rowHref,
	rowActions,
	children,
	footer,
	checkboxName,
	bulkAction,
	bulkOptions,
	bulkToken,
	bulkExtra,
	sort,
	sortOptions,
	sortBase,
	containerId,
	sub,
	chrome,
	search = true,
	isDisabled,
}: {
	title: string;
	columns: ListColumn[];
	result: RowsResult;
	emptyText?: string;
	rowHref?: (key: string, row: HestiaRow) => string | null;
	/** Per-row actions; each entry becomes one <li> in the actions <ul>. */
	rowActions?: (key: string, row: HestiaRow) => React.ReactNode[];
	children?: React.ReactNode;
	/** Footer count words, e.g. { singular: "DNS zone", plural: "DNS zones" }. */
	footer?: { singular: string; plural: string };
	/** Checkbox input name, e.g. "domain[]". Enables the checkbox column. */
	checkboxName?: string;
	/** Server action receiving { action, <checkboxName>[] } for bulk ops. */
	bulkAction?: (formData: FormData) => Promise<void>;
	bulkOptions?: BulkOption[];
	/** Session token for the bulk action's CSRF check (like other forms). */
	bulkToken?: string;
	/** Extra fields the bulk action needs (e.g. the parent domain). */
	bulkExtra?: Record<string, string>;
	/** Current ?sort= value (from the page's searchParams). */
	sort?: string;
	sortOptions?: SortOption[];
	/** Href base for sort links, including any existing query (?domain=). */
	sortBase?: string;
	/** DOM id scoping the bulk checkboxes (one ListView per page). */
	containerId?: string;
	/** Show the toolbar search box (default true; PHP has none on
	 * firewall, access-keys, keys, log, services, updates). */
	search?: boolean;
	/** Extra per-row disabled styling beyond SUSPENDED=yes
	 * (e.g. updates rows dim when UPDATED is not "yes"). */
	isDisabled?: (key: string, row: HestiaRow) => boolean;
	/** Extra line under the first-column content (e.g. DNS SRC). */
	sub?: (key: string, row: HestiaRow) => React.ReactNode;
	chrome?: ListChrome;
}) {
	if ("error" in result) {
		return (
			<div className="card">
				<h1>{title}</h1>
				<p className="error">Could not reach the Hestia command layer: {result.error}</p>
			</div>
		);
	}
	const sortBy = chrome?.sortBy ?? "Sort by";
	const searchLabel = chrome?.search ?? "Search";
	const applyLabel = chrome?.applyToSelected ?? "Apply to selected";
	const selectLabel = chrome?.select ?? "Select";
	const selectAllLabel = chrome?.selectAll ?? "Select all";
	const hasBulk = Boolean(checkboxName && bulkAction && bulkOptions?.length);
	const hasCheckbox = Boolean(checkboxName);
	const tableId = containerId ?? "list-units";
	let entries = Object.entries(result.rows);
	if (sortOptions?.length) {
		const opt = sortOptions.find((o) => o.key === sort) ?? sortOptions[0];
		const dir = opt.dir ?? "desc";
		entries = [...entries].sort(([ka, ra], [kb, rb]) => {
			const va = opt.value(ka, ra);
			const vb = opt.value(kb, rb);
			let cmp: number;
			if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
			else cmp = String(va ?? "").localeCompare(String(vb ?? ""));
			if (cmp === 0) cmp = ka.localeCompare(kb);
			return dir === "asc" ? cmp : -cmp;
		});
	}
	const currentSort = sortOptions?.find((o) => o.key === sort) ?? sortOptions?.[0] ?? null;
	const sortHref = (key: string) =>
		`${sortBase ?? ""}${(sortBase ?? "").includes("?") ? "&" : "?"}sort=${key}`;
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<h1 className="list-title">{title}</h1>
					<div className="toolbar-buttons">{children}</div>
					<div className="toolbar-right">
						{sortOptions?.length && sortBase ? (
							<div className="toolbar-sorting">
								<details>
									<summary className="toolbar-sorting-toggle" title={sortBy}>
										{sortBy}:{" "}
										<span className="u-text-bold">
											{currentSort?.label ?? ""} <i className="fas fa-arrow-down-a-z"></i>
										</span>
									</summary>
									<ul className="toolbar-sorting-menu">
										{sortOptions.map((o) => (
											<li key={o.key}>
												<Link href={sortHref(o.key)}>
													<span className="name">{o.label}</span>
												</Link>
											</li>
										))}
									</ul>
								</details>
							</div>
						) : null}
						{hasBulk ? (
							<BulkActions
								containerId={tableId}
								checkboxName={checkboxName as string}
								options={bulkOptions as BulkOption[]}
								action={bulkAction as (formData: FormData) => Promise<void>}
								applyLabel={applyLabel}
								token={bulkToken}
								extra={bulkExtra}
							/>
						) : null}
						{search ? (
							<div className="toolbar-search">
								<form action="/search" method="get">
									<input
										type="search"
										className="form-control js-search-input"
										name="q"
										title={searchLabel}
									/>
									<button type="submit" className="toolbar-input-submit" title={searchLabel}>
										<i className="fas fa-magnifying-glass"></i>
									</button>
								</form>
							</div>
						) : null}
					</div>
				</div>
			</div>
			<div className="container" id={tableId}>
				{entries.length === 0 ? (
					<p>{emptyText}</p>
				) : (
					<div className="units-table js-units-container">
						<div className="units-table-header">
							{hasCheckbox ? (
								<div className="units-table-cell">
									<SelectAllCheckbox
										containerId={tableId}
										checkboxName={checkboxName as string}
										title={selectAllLabel}
									/>
								</div>
							) : null}
							{columns.map((col) => (
								<div
									className={`units-table-cell${col.center ? " u-text-center" : ""}`}
									key={col.key}
								>
									{col.label}
								</div>
							))}
							{rowActions ? <div className="units-table-cell"></div> : null}
						</div>
						{entries.map(([key, row], index) => (
							<div
								className={`units-table-row js-unit${row.SUSPENDED === "yes" || isDisabled?.(key, row) ? " disabled" : ""}`}
								key={key}
							>
								{hasCheckbox ? (
									<div className="units-table-cell">
										<div>
											<input
												id={`check${index}`}
												className="js-unit-checkbox"
												type="checkbox"
												title={selectLabel}
												name={checkboxName}
												value={key}
											/>
											<label htmlFor={`check${index}`} className="u-hide-desktop">
												{selectLabel}
											</label>
										</div>
									</div>
								) : null}
								{columns.map((col, i) => {
									const raw = row[col.key] ?? "";
									// First column: fall back to the row key
									// (the object's name) when the field is
									// absent — see the header comment.
									const value = i === 0 && !raw ? key : raw;
									const text = col.format ? col.format(value, row, key) : value;
									const subNode = i === 0 && sub ? sub(key, row) : null;
									const cellClass = `units-table-cell${i === 0 || col.heading ? " units-table-heading-cell u-text-bold" : ""}${col.center ? " u-text-center-desktop" : ""}`;
									return (
										<div className={cellClass} key={col.key}>
											{i > 0 ? (
												<span className="u-hide-desktop u-text-bold">{col.label}:</span>
											) : null}
											{i === 0 && rowHref
												? (() => {
														const href = rowHref(key, row);
														return href ? <Link href={href}>{text}</Link> : text;
													})()
												: text}
											{subNode}
										</div>
									);
								})}
								{rowActions ? (
									<div className="units-table-cell">
										<ul className="units-table-row-actions">
											{rowActions(key, row).map((action, i) => (
												<li className="units-table-row-action" key={i}>
													{action}
												</li>
											))}
										</ul>
									</div>
								) : null}
							</div>
						))}
					</div>
				)}
				{footer ? (
					<div className="units-table-footer">
						<p>
							{entries.length} {entries.length === 1 ? footer.singular : footer.plural}
						</p>
					</div>
				) : null}
			</div>
		</div>
	);
}
