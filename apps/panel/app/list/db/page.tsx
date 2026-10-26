import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";
import { ListView } from "@/components/ListView";
import { RowAction, RowActionButton } from "@/components/RowAction";
import { toggleDatabaseAction } from "./actions";

export default async function Page() {
	const session = await requireSession();
	const user = effectiveUser(session);
	const t = await getT();
	const token = String(session.data.token ?? "");
	const result = await loadRows(() => hestia.listDatabases(user));
	return (
		<ListView
			title={t("Databases")}
			result={result}
			columns={[
				{ key: "DATABASE", label: t("Databases") },
				{ key: "DBUSER", label: t("User") },
				{ key: "HOST", label: t("Host") },
				{ key: "TYPE", label: t("Type") },
				{ key: "U_DISK", label: t("Disk"), format: (v) => `${v} MB` },
				{ key: "SUSPENDED", label: t("Suspended") },
			]}
			rowActions={(key, row) => (
				<>
					<RowAction
						href={`/edit/db?database=${encodeURIComponent(key)}`}
						title={t("Edit")}
						icon="fa-pencil icon-orange"
					/>{" "}
					<form action={toggleDatabaseAction} style={{ display: "inline" }}>
						<input type="hidden" name="token" value={token} />
						<input type="hidden" name="database" value={key} />
						<input
							type="hidden"
							name="op"
							value={row.SUSPENDED === "yes" ? "unsuspend" : "suspend"}
						/>
						<RowActionButton
							title={row.SUSPENDED === "yes" ? t("Unsuspend") : t("Suspend")}
							icon={row.SUSPENDED === "yes" ? "fa-play icon-green" : "fa-pause icon-highlight"}
						/>
					</form>{" "}
					<RowAction
						href={`/delete/db?database=${encodeURIComponent(key)}`}
						title={t("Delete")}
						icon="fa-trash icon-red"
					/>
				</>
			)}
		>
			<Link className="button button-secondary" href="/add/db">
				<i className="fas fa-circle-plus icon-green"></i>
				{t("Add Database")}
			</Link>
		</ListView>
	);
}
