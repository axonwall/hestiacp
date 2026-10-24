import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { editWebDomainAction } from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string; error?: string; saved?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const query = await searchParams;
	const user = effectiveUser(session);
	const domain = query.domain ?? "";
	const record = domain
		? await hestia.listWebDomain(user, domain).catch(() => null)
		: null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Web Domain")}</h1>
				<p className="error">{query.error ?? "Domain not found."}</p>
				<p><a href="/list/web">{t("Back")}</a></p>
			</div>
		);
	}
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	const [ips, templates, backends, proxies, statsSystems] = await Promise.all([
		hestia.listUserIps(user).catch((): Record<string, HestiaRow> => ({})),
		isAdmin ? hestia.listWebTemplates().catch(() => []) : Promise.resolve([]),
		isAdmin ? hestia.listWebTemplatesBackend().catch(() => []) : Promise.resolve([]),
		hestia.listWebTemplatesProxy().catch(() => []),
		hestia.listWebStatsSystems().catch(() => []),
	]);
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit Web Domain")} — {domain}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<form action={editWebDomainAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label htmlFor="ip">{t("IP Address")}</label>
				<select id="ip" name="ip" defaultValue={record.IP}>
					{Object.keys(ips).map((ip) => (
						<option key={ip} value={ip}>{ip}</option>
					))}
					{!ips[record.IP] ? <option value={record.IP}>{record.IP}</option> : null}
				</select>
				{isAdmin ? (
					<>
						<label htmlFor="template">{t("Web Template")}</label>
						<select id="template" name="template" defaultValue={record.TPL}>
							{templates.map((tpl) => (
								<option key={tpl} value={tpl}>{tpl}</option>
							))}
						</select>
						<label htmlFor="backendTemplate">{t("Backend Template")}</label>
						<select id="backendTemplate" name="backendTemplate" defaultValue={record.BACKEND}>
							{backends.map((tpl) => (
								<option key={tpl} value={tpl}>{tpl}</option>
							))}
						</select>
					</>
				) : null}
				<label htmlFor="proxyTemplate">{t("Proxy Template")}</label>
				<select id="proxyTemplate" name="proxyTemplate" defaultValue={record.PROXY ?? ""}>
					<option value="">{t("Disabled")}</option>
					{proxies.map((tpl) => (
						<option key={tpl} value={tpl}>{tpl}</option>
					))}
				</select>
				<label htmlFor="proxyExt">{t("Proxy Extensions")}</label>
				<input id="proxyExt" name="proxyExt" defaultValue={record.PROXY_EXT ?? ""} />
				<label htmlFor="aliases">{t("Aliases")}</label>
				<textarea
					id="aliases"
					name="aliases"
					rows={3}
					defaultValue={(record.ALIAS ?? "").split(",").filter(Boolean).join("\n")}
				/>
				<label>
					<input type="checkbox" name="letsencrypt" value="yes" defaultChecked={record.LETSENCRYPT === "yes"} />{" "}
					Let&apos;s Encrypt
				</label>
				<label htmlFor="sslKeyAlgo">{t("SSL key algorithm")}</label>
				<input id="sslKeyAlgo" name="sslKeyAlgo" defaultValue={record.SSL_KEY_ALGO ?? ""} placeholder="RSA3072 / EC384" />
				{record.SSL === "yes" && record.LETSENCRYPT !== "yes" ? (
					<label>
						<input type="checkbox" name="removeSsl" value="yes" /> {t("Remove SSL certificate")}
					</label>
				) : null}
				<label>
					<input type="checkbox" name="sslForce" value="yes" defaultChecked={record.SSL_FORCE === "yes"} />{" "}
					{t("Force SSL")}
				</label>
				<label>
					<input type="checkbox" name="sslHsts" value="yes" defaultChecked={record.SSL_HSTS === "yes"} />{" "}
					HSTS
				</label>
				<label>
					<input type="checkbox" name="fastcgi" value="yes" defaultChecked={record.FASTCGI_CACHE === "yes"} />{" "}
					{t("FastCGI cache")}
				</label>
				<label htmlFor="fastcgiDuration">{t("Cache duration")}</label>
				<input id="fastcgiDuration" name="fastcgiDuration" defaultValue={record.FASTCGI_DURATION ?? ""} placeholder="5m" />
				<label htmlFor="stats">{t("Web Statistics")}</label>
				<select id="stats" name="stats" defaultValue={record.STATS ?? ""}>
					<option value="">{t("Disabled")}</option>
					{statsSystems.map((s) => (
						<option key={s} value={s}>{s}</option>
					))}
				</select>
				<button type="submit" className="primary">{t("Save")}</button>
			</form>
			<p>
				<a href="/list/web">{t("Back")}</a> ·{" "}
				<a href={`/delete/web?domain=${encodeURIComponent(domain)}`}>{t("Delete")}</a>
			</p>
		</div>
	);
}
