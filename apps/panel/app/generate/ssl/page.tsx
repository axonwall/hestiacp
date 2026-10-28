import { getT, requireSession, sessions } from "@/lib/panel";
import { generateSslAction } from "./actions";

type GeneratedSsl = { domain: string; CRT: string; KEY: string; CSR: string };

/**
 * Generate a self-signed cert (web/generate/ssl/ + generate_ssl.php):
 * the form (PHP's defaults), or the result view (list_ssl.php:
 * certificate, private key, CSR in readonly textareas with
 * download links). The result is stashed in the session by the
 * action and cleared on first read. Downloads are plain data
 * URIs (PHP builds blobs with Alpine JS; the panel has no such
 * helper).
 */
export default async function GenerateSslPage({
	searchParams,
}: {
	searchParams: Promise<{
		domain?: string;
		error?: string;
		generated?: string;
	}>;
}) {
	const session = await requireSession();
	const query = await searchParams;
	const t = await getT();
	const token = String(session.data.token ?? "");
	let result: GeneratedSsl | null = null;
	if (query.generated === "1") {
		const raw = session.data.hestiang_generated_ssl;
		if (typeof raw === "string") {
			try {
				result = JSON.parse(raw) as GeneratedSsl;
			} catch {
				result = null;
			}
		}
		if (session.data.hestiang_generated_ssl !== undefined) {
			delete session.data.hestiang_generated_ssl;
			await sessions.set(session.id, session.data);
		}
	}
	if (result) {
		const downloads = [
			{ label: t("SSL Certificate"), value: result.CRT, ext: "crt" },
			{ label: t("SSL Private Key"), value: result.KEY, ext: "key" },
			{ label: t("SSL CSR"), value: result.CSR, ext: "csr" },
		];
		return (
			<div>
				<h1 className="u-mb20">{t("Generate Self-Signed SSL Certificate")}</h1>
				<p>{t("Certificate has been generated successfully.")}</p>
				{downloads.map((item) => (
					<div key={item.ext} className="u-mb20">
						<label className="form-label u-side-by-side" htmlFor={`ssl-${item.ext}`}>
							{item.label}
							<a
								href={`data:text/plain;charset=utf-8,${encodeURIComponent(item.value)}`}
								download={`${result.domain}.${item.ext}`}
								title={t("Download")}
							>
								<i className="fas fa-download"></i>
								<span className="u-hidden">{t("Download")}</span>
							</a>
						</label>
						<textarea
							id={`ssl-${item.ext}`}
							className="form-control u-min-height100"
							readOnly
							value={item.value}
						/>
					</div>
				))}
			</div>
		);
	}
	const domain = query.domain ?? "";
	return (
		<div>
			<form action={generateSslAction}>
				<input type="hidden" name="token" value={token} />
				<h1 className="u-mb20">{t("Generate Self-Signed SSL Certificate")}</h1>
				{query.error ? <p className="error">{query.error}</p> : null}
				<div className="u-mb20">
					<label htmlFor="domain" className="form-label">
						{t("Domain")}
					</label>
					<input
						type="text"
						className="form-control"
						name="domain"
						id="domain"
						defaultValue={domain || "example.tld"}
					/>
				</div>
				<div className="u-mb20">
					<label htmlFor="aliases" className="form-label">
						{t("Aliases")}
					</label>
					<textarea className="form-control" name="aliases" id="aliases" />
				</div>
				<div className="u-mb20">
					<label htmlFor="email" className="form-label">
						{t("Email")} <span className="optional">({t("Optional")})</span>
					</label>
					<input type="email" className="form-control" name="email" id="email" />
				</div>
				<div className="u-mb20">
					<label htmlFor="country" className="form-label">
						{t("Country")}{" "}
						<span className="optional">({t("ISO 3166-1 alpha-2 two-letter code")})</span>
					</label>
					<input
						type="text"
						className="form-control"
						name="country"
						id="country"
						defaultValue="US"
					/>
				</div>
				<div className="u-mb20">
					<label htmlFor="state" className="form-label">
						{t("State / Province")}
					</label>
					<input
						type="text"
						className="form-control"
						name="state"
						id="state"
						defaultValue="California"
					/>
				</div>
				<div className="u-mb20">
					<label htmlFor="locality" className="form-label">
						{t("City / Locality")}
					</label>
					<input
						type="text"
						className="form-control"
						name="locality"
						id="locality"
						defaultValue="San Francisco"
					/>
				</div>
				<div className="u-mb20">
					<label htmlFor="org" className="form-label">
						{t("Organization")}
					</label>
					<input
						type="text"
						className="form-control"
						name="org"
						id="org"
						defaultValue="MyCompany Inc"
					/>
				</div>
				<div className="u-mb20">
					<label htmlFor="keyAlgo" className="form-label">
						{t("Key Type")}
					</label>
					<select className="form-select" name="keyAlgo" id="keyAlgo">
						<option value="ecdsa-256">ECDSA P-256 ({t("recommended")})</option>
						<option value="ecdsa-384">ECDSA P-384</option>
						<option value="rsa">RSA 4096</option>
					</select>
				</div>
				<button type="submit" className="button" name="generate">
					{t("Generate")}
				</button>
			</form>
		</div>
	);
}
