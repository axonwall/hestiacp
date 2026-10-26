"use client";

import { useState, useTransition } from "react";
import type { BulkOption } from "./ListView";

/**
 * Client islands for ListView bulk selection. Kept tiny on purpose:
 * the table itself stays a server component, and these two controls
 * are the only pieces that need browser interaction.
 *
 * There is deliberately no wrapping <form> around the table: rows
 * already contain their own <form>s (suspend toggles), and nested
 * forms submit to the outer form, which would break those toggles.
 * Instead the bulk submit gathers the checked boxes by container id
 * and calls the page's server action directly.
 */

export function SelectAllCheckbox({
	containerId,
	checkboxName,
	title,
}: {
	containerId: string;
	checkboxName: string;
	title: string;
}) {
	function toggle(e: React.ChangeEvent<HTMLInputElement>) {
		const root = document.getElementById(containerId);
		root?.querySelectorAll(`input[name="${CSS.escape(checkboxName)}"]`).forEach((el) => {
			(el as HTMLInputElement).checked = e.target.checked;
		});
	}
	return (
		<input type="checkbox" className="js-toggle-all-checkbox" title={title} onChange={toggle} />
	);
}

export function BulkActions({
	containerId,
	checkboxName,
	options,
	action,
	applyLabel,
	token,
	extra,
}: {
	containerId: string;
	checkboxName: string;
	options: BulkOption[];
	action: (formData: FormData) => Promise<void>;
	applyLabel: string;
	token?: string;
	extra?: Record<string, string>;
}) {
	const [op, setOp] = useState(options[0]?.value ?? "");
	const [pending, startTransition] = useTransition();
	function submit(e: React.FormEvent) {
		e.preventDefault();
		const root = document.getElementById(containerId);
		const checked = root?.querySelectorAll(`input[name="${CSS.escape(checkboxName)}"]:checked`);
		if (!checked || checked.length === 0) return;
		const fd = new FormData();
		fd.set("action", op);
		if (token) fd.set("token", token);
		if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
		checked.forEach((el) => fd.append(checkboxName, (el as HTMLInputElement).value));
		startTransition(() => {
			void action(fd);
		});
	}
	return (
		<form onSubmit={submit}>
			<select
				className="form-select"
				name="action"
				value={op}
				onChange={(e) => setOp(e.target.value)}
			>
				<option value="">{applyLabel}</option>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
			<button type="submit" className="toolbar-input-submit" title={applyLabel} disabled={pending}>
				<i className="fas fa-arrow-right"></i>
			</button>
		</form>
	);
}
