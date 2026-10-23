import { USER_PACKAGE_FIELDS } from "@hestiacp/lib";

/**
 * Shared package form (add + edit). Every USER_PACKAGE_FIELDS entry is a
 * plain text input — the PHP form uses selects for the template fields,
 * populated from v-list-*-template enumerations; text inputs are the
 * Phase 1 shell's simplification and carry the same values.
 */
export function PackageFormFields({
	values,
	token,
	submitLabel,
}: {
	values: Record<string, string>;
	token: string;
	submitLabel: string;
}) {
	return (
		<>
			<input type="hidden" name="token" value={token} />
			{USER_PACKAGE_FIELDS.map((field) => (
				<div key={field}>
					<label htmlFor={`f-${field}`}>{field}</label>
					<input
						id={`f-${field}`}
						name={field}
						defaultValue={values[field] ?? ""}
					/>
				</div>
			))}
			<button type="submit" className="primary">
				{submitLabel}
			</button>
		</>
	);
}

export function readPackageFields(
	formData: FormData,
): Record<string, string> {
	const fields: Record<string, string> = {};
	for (const field of USER_PACKAGE_FIELDS) {
		fields[field] = String(formData.get(field) ?? "").trim();
	}
	return fields;
}
