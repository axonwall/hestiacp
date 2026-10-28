"use client";

import type { ReactNode } from "react";

/**
 * A link that asks for confirmation first (PHP's js-confirm-action
 * dialog, here as a native confirm since the panel has no modal
 * infrastructure). Used for the system-restart button.
 */
export default function ConfirmLink({
	href,
	className,
	title,
	message,
	children,
}: {
	href: string;
	className?: string;
	title?: string;
	message: string;
	children: ReactNode;
}) {
	return (
		<a
			className={className}
			href={href}
			title={title}
			onClick={(event) => {
				if (!window.confirm(message)) {
					event.preventDefault();
				}
			}}
		>
			{children}
		</a>
	);
}
