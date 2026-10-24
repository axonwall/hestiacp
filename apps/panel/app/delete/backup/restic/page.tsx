import Link from "next/link";
import { getT, requireSession } from "@/lib/panel";
import { deleteResticAction } from "./actions";

export default async function DeleteResticPage({
	searchParams,
}: {
	searchParams: Promise<{ snapshot?: string; error?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const { snapshot = "", error } = await searchParams;
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Delete")} {t("Snapshot")} {snapshot}?
			</h1>
			{error === "confirm" ? (
				<p className="error">Please tick the confirmation box first.</p>
			) : null}
			<p>Incremental snapshots are pruned from the restic repository.</p>
			<form action={deleteResticAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="snapshot" value={snapshot} />
				<label>
					<input type="checkbox" name="confirm" value="yes" /> Yes, delete
					this snapshot
				</label>
				<button type="submit" className="danger">
					{t("Delete")}
				</button>{" "}
				<Link href="/list/backup/restic">Cancel</Link>
			</form>
		</div>
	);
}
