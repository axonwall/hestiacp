import Link from "next/link";
import { effectiveUser, getT, hestia, loadRows, requireSession } from "@/lib/panel";

/** Public DNSSEC key of one domain (PHP web/templates/pages/list_dns_public.php). */
const ALGORITHMS: Record<string, string> = {
	"3": "3 - DSA",
	"5": "5 - RSA/SHA1",
	"6": "6 - DSA-NSEC3-SHA1",
	"7": "7 - RSA/SHA1-NSEC3-SHA1",
	"8": "8 - RSA/SHA256",
	"10": "10 - RSA/SHA512",
	"12": "12 - ECC-GOST",
	"13": "13 - ECDSAP256/SHA256",
	"14": "14 - ECDSAP384/SHA384",
	"15": "15 - ED25519/SHA512",
	"16": "16 - ED448/SHA912",
};

function flagLabel(flag: string | undefined): string {
	if (flag === "257") return "KSK (257)";
	if (flag === "256") return "ZSK (256)";
	return "";
}

function Field({ label, value }: { label: string; value: string | undefined }) {
	const id = `dnssec-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
	return (
		<div className="u-mb10">
			<label className="form-label" htmlFor={id}>
				{label}
			</label>
			<input id={id} type="text" className="form-control" value={value ?? ""} readOnly />
		</div>
	);
}

export default async function DnssecPage({
	searchParams,
}: {
	searchParams: Promise<{ domain?: string }>;
}) {
	const session = await requireSession();
	const t = await getT();
	const user = effectiveUser(session);
	const token = String(session.data.token ?? "");
	const { domain } = await searchParams;
	if (!domain) {
		return (
			<div className="card">
				<h1>{t("View Public DNSSEC Key")}</h1>
				<p>
					<a href="/list/dns">{t("Back")}</a> — pick a domain first.
				</p>
			</div>
		);
	}
	const result = await loadRows(() => hestia.listDnssecPublicKey(user, domain));
	if ("error" in result) {
		return (
			<div>
				<p className="error">{result.error}</p>
			</div>
		);
	}
	const row = result.rows[domain];
	if (!row) {
		return (
			<div className="card">
				<h1>{t("View Public DNSSEC Key")}</h1>
				<p className="error">
					{t("No DNSSEC key for domain")}: {domain}
				</p>
				<p>
					<a href="/list/dns">{t("Back")}</a>
				</p>
			</div>
		);
	}
	return (
		<div>
			<div className="toolbar">
				<div className="toolbar-inner">
					<div className="toolbar-buttons">
						<Link href="/add/dns" className="button button-secondary js-button-create">
							<i className="fas fa-circle-plus icon-green"></i>
							{t("Add DNS Domain")}
						</Link>
					</div>
					<div className="toolbar-right">
						<div className="toolbar-search">
							<form action="/search/" method="get">
								<input type="hidden" name="token" value={token} />
								<input
									type="search"
									className="form-control js-search-input"
									name="q"
									title={t("Search")}
								/>
								<button type="submit" className="toolbar-input-submit" title={t("Search")}>
									<i className="fas fa-magnifying-glass"></i>
								</button>
							</form>
						</div>
					</div>
				</div>
			</div>
			<div className="container">
				<div className="form-container">
					<h1 className="u-mb20">{t("View Public DNSSEC Key")}</h1>
					<Field label={t("DNSKEY Record")} value={row.RECORD} />
					<Field label={t("DS Record")} value={row.DS} />
					<Field label={t("Public Key")} value={row.KEY} />
					<Field label={t("Key Type / Flag")} value={flagLabel(row.FLAG)} />
					<Field label={t("Key Tag")} value={row.KEYTAG} />
					<Field label={t("Flag")} value={row.FLAG} />
					<Field
						label={t("Algorithm")}
						value={row.ALGORITHM ? (ALGORITHMS[row.ALGORITHM] ?? t("Unknown")) : ""}
					/>
				</div>
			</div>
		</div>
	);
}
