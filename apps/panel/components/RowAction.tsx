import Link from "next/link";

/**
 * PHP's units-table row actions (every list template): icon-only on
 * desktop with the label kept for small screens (u-hide-desktop),
 * using the theme's .units-table-row-action-link class. RowAction
 * renders a Next link; RowActionAnchor a plain <a> (downloads and
 * other non-prefetchable targets); RowActionButton the same look
 * on a form submit button (suspend toggles, service controls).
 */
function ActionIcon({ icon, title }: { icon: string; title: string }) {
	return (
		<>
			<i className={`fas ${icon}`}></i>
			<span className="u-hide-desktop">{title}</span>
		</>
	);
}

export function RowAction({
	href,
	title,
	icon,
	plain,
}: {
	href: string;
	title: string;
	icon: string;
	/** Render a plain <a> instead of a Next link. */
	plain?: boolean;
}) {
	if (plain) {
		return (
			<a className="units-table-row-action-link" title={title} href={href}>
				<ActionIcon icon={icon} title={title} />
			</a>
		);
	}
	return (
		<Link className="units-table-row-action-link" title={title} href={href}>
			<ActionIcon icon={icon} title={title} />
		</Link>
	);
}

export function RowActionButton({ title, icon }: { title: string; icon: string }) {
	return (
		<button type="submit" className="units-table-row-action-link" title={title}>
			<ActionIcon icon={icon} title={title} />
		</button>
	);
}
