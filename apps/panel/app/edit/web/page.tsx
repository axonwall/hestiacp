import { effectiveUser, getT, hestia, requireSession } from "@/lib/panel";
import type { HestiaRow } from "@hestiacp/lib";
import { editWebDomainAction } from "./actions";
import { editWebDomainSslAction } from "./ssl-actions";
import { editWebDomainStatsAuthAction } from "./stats-actions";
import { addWebDomainFtpAction, updateWebDomainFtpAction } from "./ftp-actions";

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
	const record = domain ? await hestia.listWebDomain(user, domain).catch(() => null) : null;
	if (!record) {
		return (
			<div className="card">
				<h1>{t("Edit Web Domain")}</h1>
				<p className="error">{query.error ?? "Domain not found."}</p>
				<p>
					<a href="/list/web">{t("Back")}</a>
				</p>
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
	const sslRecord =
		record.SSL === "yes" ? await hestia.listWebDomainSsl(user, domain).catch(() => null) : null;
	const ftpUsers = (record.FTP_USER ?? "").split(",").filter(Boolean);
	const ftpPaths = (record.FTP_PATH ?? "").split(",");
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>
				{t("Edit Web Domain")} — {domain}
			</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p>{t("Saved")}</p> : null}
			<p>
				<a href={`/list/webapps?domain=${encodeURIComponent(domain)}`}>Quick Install App →</a>
			</p>
			<form action={editWebDomainAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label htmlFor="ip">{t("IP Address")}</label>
				<select className="form-select" id="ip" name="ip" defaultValue={record.IP}>
					{Object.keys(ips).map((ip) => (
						<option key={ip} value={ip}>
							{ip}
						</option>
					))}
					{!ips[record.IP] ? <option value={record.IP}>{record.IP}</option> : null}
				</select>
				{isAdmin ? (
					<>
						<label htmlFor="template">{t("Web Template")}</label>
						<select className="form-select" id="template" name="template" defaultValue={record.TPL}>
							{templates.map((tpl) => (
								<option key={tpl} value={tpl}>
									{tpl}
								</option>
							))}
						</select>
						<label htmlFor="backendTemplate">{t("Backend Template")}</label>
						<select
							className="form-select"
							id="backendTemplate"
							name="backendTemplate"
							defaultValue={record.BACKEND}
						>
							{backends.map((tpl) => (
								<option key={tpl} value={tpl}>
									{tpl}
								</option>
							))}
						</select>
					</>
				) : null}
				<label htmlFor="proxyTemplate">{t("Proxy Template")}</label>
				<select
					className="form-select"
					id="proxyTemplate"
					name="proxyTemplate"
					defaultValue={record.PROXY ?? ""}
				>
					<option value="">{t("Disabled")}</option>
					{proxies.map((tpl) => (
						<option key={tpl} value={tpl}>
							{tpl}
						</option>
					))}
				</select>
				<label htmlFor="proxyExt">{t("Proxy Extensions")}</label>
				<input
					className="form-control"
					id="proxyExt"
					name="proxyExt"
					defaultValue={record.PROXY_EXT ?? ""}
				/>
				<label htmlFor="aliases">{t("Aliases")}</label>
				<textarea
					className="form-control"
					id="aliases"
					name="aliases"
					rows={3}
					defaultValue={(record.ALIAS ?? "").split(",").filter(Boolean).join("\n")}
				/>
				<label>
					<input
						type="checkbox"
						name="letsencrypt"
						value="yes"
						defaultChecked={record.LETSENCRYPT === "yes"}
					/>{" "}
					Let&apos;s Encrypt
				</label>
				<label htmlFor="sslKeyAlgo">{t("SSL key algorithm")}</label>
				<input
					className="form-control"
					id="sslKeyAlgo"
					name="sslKeyAlgo"
					defaultValue={record.SSL_KEY_ALGO ?? ""}
					placeholder="RSA3072 / EC384"
				/>
				{record.SSL === "yes" && record.LETSENCRYPT !== "yes" ? (
					<label>
						<input type="checkbox" name="removeSsl" value="yes" /> {t("Remove SSL certificate")}
					</label>
				) : null}
				<label>
					<input
						type="checkbox"
						name="sslForce"
						value="yes"
						defaultChecked={record.SSL_FORCE === "yes"}
					/>{" "}
					{t("Force SSL")}
				</label>
				<label>
					<input
						type="checkbox"
						name="sslHsts"
						value="yes"
						defaultChecked={record.SSL_HSTS === "yes"}
					/>{" "}
					HSTS
				</label>
				<label>
					<input
						type="checkbox"
						name="fastcgi"
						value="yes"
						defaultChecked={record.FASTCGI_CACHE === "yes"}
					/>{" "}
					{t("FastCGI cache")}
				</label>
				<label htmlFor="fastcgiDuration">{t("Cache duration")}</label>
				<input
					className="form-control"
					id="fastcgiDuration"
					name="fastcgiDuration"
					defaultValue={record.FASTCGI_DURATION ?? ""}
					placeholder="5m"
				/>
				<label htmlFor="stats">{t("Web Statistics")}</label>
				<select className="form-select" id="stats" name="stats" defaultValue={record.STATS ?? ""}>
					<option value="">{t("Disabled")}</option>
					{statsSystems.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			<p>
				<a href="/list/web">{t("Back")}</a> ·{" "}
				<a href={`/delete/web?domain=${encodeURIComponent(domain)}`}>{t("Delete")}</a>
			</p>
			<h2>SSL {t("Certificate")}</h2>
			{sslRecord ? (
				<p>
					{sslRecord.SUBJECT} · {sslRecord.ISSUER} · {sslRecord.NOT_BEFORE} → {sslRecord.NOT_AFTER}
				</p>
			) : null}
			<form action={editWebDomainSslAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label htmlFor="sslCrt">{t("Certificate")}</label>
				<textarea
					className="form-control"
					id="sslCrt"
					name="crt"
					rows={4}
					defaultValue={sslRecord?.CRT ?? ""}
				/>
				<label htmlFor="sslKey">{t("Key")}</label>
				<textarea
					className="form-control"
					id="sslKey"
					name="key"
					rows={4}
					defaultValue={sslRecord?.KEY ?? ""}
				/>
				<label htmlFor="sslCa">{t("CA chain")}</label>
				<textarea
					className="form-control"
					id="sslCa"
					name="ca"
					rows={3}
					defaultValue={sslRecord?.CA ?? ""}
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			<span>
				{" "}
				/{" "}
				<a
					className="form-link"
					target="_blank"
					rel="noopener"
					href={`/generate/ssl?domain=${encodeURIComponent(domain)}`}
				>
					{t("Generate Self-Signed SSL Certificate")}
				</a>
			</span>
			<h2>{t("FTP Accounts")}</h2>
			{ftpUsers.map((ftpUser, i) => (
				<form key={ftpUser} action={updateWebDomainFtpAction}>
					<input type="hidden" name="token" value={token} />
					<input type="hidden" name="domain" value={domain} />
					<input type="hidden" name="ftpUser" value={ftpUser} />
					<input type="hidden" name="prevPath" value={ftpPaths[i] ?? ""} />
					<label htmlFor={`ftpPath-${i}`}>
						{ftpUser} — {t("Path")}
					</label>
					<input
						className="form-control"
						id={`ftpPath-${i}`}
						name="path"
						defaultValue={ftpPaths[i] ?? ""}
					/>
					<label htmlFor={`ftpPass-${i}`}>
						{t("New password")} ({t("leave empty to keep")})
					</label>
					<input
						className="form-control"
						id={`ftpPass-${i}`}
						name="secret"
						type="password"
						autoComplete="new-password"
					/>
					<label>
						<input type="checkbox" name="delete" value="yes" /> {t("Delete")}
					</label>
					<button type="submit">{t("Save")}</button>
				</form>
			))}
			<form action={addWebDomainFtpAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label htmlFor="newFtpUser">
					{t("Add FTP account")} ({user}_…)
				</label>
				<input className="form-control" id="newFtpUser" name="ftpUser" />
				<label htmlFor="newFtpPass">{t("Password")}</label>
				<input
					className="form-control"
					id="newFtpPass"
					name="secret"
					type="password"
					autoComplete="new-password"
				/>
				<label htmlFor="newFtpPath">{t("Path")}</label>
				<input className="form-control" id="newFtpPath" name="path" />
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>
			<h2>{t("Stats Authorization")}</h2>
			<form action={editWebDomainStatsAuthAction}>
				<input type="hidden" name="token" value={token} />
				<input type="hidden" name="domain" value={domain} />
				<label>
					<input
						type="checkbox"
						name="statsAuth"
						value="yes"
						defaultChecked={!!record.STATS_USER}
					/>{" "}
					{t("Protect stats with a password")}
				</label>
				<label htmlFor="statsUser">{t("Stats user")}</label>
				<input
					className="form-control"
					id="statsUser"
					name="statsUser"
					defaultValue={record.STATS_USER ?? ""}
				/>
				<label htmlFor="statsPass">
					{t("Stats password")} ({t("leave empty to keep")})
				</label>
				<input
					className="form-control"
					id="statsPass"
					name="secret"
					type="password"
					autoComplete="new-password"
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
		</div>
	);
}
