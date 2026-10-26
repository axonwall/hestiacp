import Link from "next/link";
import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";

/**
 * Global search (web/search): admins search every object via
 * v-search-object (or one user's via ?u=); everyone else searches
 * their own account with v-search-user-object. Rows link to the
 * matching edit page, as the PHP results do.
 */
const EDIT_LINKS: Record<string, (key: string) => string> = {
	web: (k) => `/edit/web?domain=${encodeURIComponent(k)}`,
	dns: (k) => `/edit/dns?domain=${encodeURIComponent(k)}`,
	mail: (k) => `/edit/mail?domain=${encodeURIComponent(k)}`,
	db: (k) => `/edit/db?database=${encodeURIComponent(k)}`,
	cron: (k) => `/edit/cron?job=${encodeURIComponent(k)}`,
	user: (k) => `/users/${encodeURIComponent(k)}`,
};

export default async function SearchPage({
	searchParams,
}: {
	searchParams: Promise<{ q?: string; u?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const { q = "", u } = await searchParams;
	const me = effectiveUser(session);
	let results: Awaited<ReturnType<typeof hestia.searchObjects>> = [];
	let error = "";
	if (q) {
		try {
			if (session.data.userContext === "admin" && !session.data.look) {
				results = u ? await hestia.searchUserObjects(u, q) : await hestia.searchObjects(q);
			} else {
				results = await hestia.searchUserObjects(me, q);
			}
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		}
	}
	return (
		<div className="card">
			<h1>{t("Search")}</h1>
			<form method="get" className="inline-form">
				<input
					className="form-control"
					name="q"
					defaultValue={q}
					placeholder={t("Search")}
					aria-label={t("Search")}
				/>
				<button type="submit" className="button">
					{t("Search")}
				</button>
			</form>
			{error ? <p className="error">{error}</p> : null}
			{q && !error ? (
				results.length === 0 ? (
					<p>{t("No results found.")}</p>
				) : (
					<ul>
						{results.map((row) => {
							const link = EDIT_LINKS[row.TYPE?.toLowerCase() ?? ""];
							return (
								<li key={`${row.USER ?? ""}-${row.TYPE}-${row.KEY}`}>
									{link ? <Link href={link(row.KEY)}>{row.RESULT}</Link> : row.RESULT}{" "}
									<small>
										{row.TYPE}
										{row.USER && row.USER !== me ? ` · ${row.USER}` : ""}
									</small>
								</li>
							);
						})}
					</ul>
				)
			) : null}
		</div>
	);
}
