"use server";

import { redirect } from "next/navigation";
import { csrfValid, effectiveUser, errorMessage, hestia, requireSession } from "@/lib/panel";

function splitAliases(raw: string): string[] {
	return raw
		.split(/[\s,]+/)
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
}

/**
 * Edit a web domain (web/edit/web), changed-only like the PHP page:
 * IP (which also moves the DNS zone, alias DNS zones, and rebuilds the
 * mail domain), templates (admin), proxy, alias diff (with DNS-on-alias
 * entries when a DNS zone exists), Let's Encrypt / SSL toggles, fastcgi
 * cache, stats system. Any change restarts web + proxy at the end, as
 * the page does, and DNS moves restart DNS.
 * Custom certificates, FTP accounts and stats users stay PHP-side for
 * now (see README).
 */
export async function editWebDomainAction(formData: FormData): Promise<void> {
	const session = await requireSession();
	const domain = String(formData.get("domain") ?? "");
	const back = `/edit/web?domain=${encodeURIComponent(domain)}`;
	if (!csrfValid(session, formData) || !domain) redirect(`${back}&error=csrf`);
	const user = effectiveUser(session);
	const isAdmin = session.data.userContext === "admin" && !session.data.look;
	let changed = false;
	let dnsChanged = false;
	try {
		const current = await hestia.listWebDomain(user, domain);

		const ip = String(formData.get("ip") ?? "");
		const effectiveIp = ip || current.IP;
		if (ip && ip !== current.IP) {
			const currentAliases = splitAliases(current.ALIAS ?? "");
			dnsChanged = await hestia.changeWebDomainIp(user, domain, ip, currentAliases);
			changed = true;
		}

		if (isAdmin) {
			const tpl = String(formData.get("template") ?? "");
			if (tpl && tpl !== current.TPL) {
				await hestia.changeWebDomainTpl(user, domain, tpl);
				changed = true;
			}
			const backend = String(formData.get("backendTemplate") ?? "");
			if (backend && backend !== current.BACKEND) {
				await hestia.changeWebDomainBackendTpl(user, domain, backend);
				changed = true;
			}
		}

		// Proxy: empty select = disabled
		const proxyTpl = String(formData.get("proxyTemplate") ?? "");
		const proxyExt = String(formData.get("proxyExt") ?? "").trim();
		if (!proxyTpl && current.PROXY) {
			await hestia.deleteWebDomainProxy(user, domain);
			changed = true;
		} else if (proxyTpl && !current.PROXY) {
			await hestia.addWebDomainProxy(user, domain, proxyTpl, proxyExt);
			changed = true;
		} else if (proxyTpl && (proxyTpl !== current.PROXY || proxyExt !== (current.PROXY_EXT ?? ""))) {
			await hestia.changeWebDomainProxyTpl(user, domain, proxyTpl, proxyExt);
			changed = true;
		}

		// Aliases: diff the posted set against the current CSV. When a DNS
		// zone exists for the web domain, PHP also adds/removes the
		// alias's DNS entry (v-add/delete-dns-on-web-alias) and restarts
		// DNS; the add uses the post-edit (new, if changed) public IP.
		const postedAliases = splitAliases(String(formData.get("aliases") ?? ""));
		const currentAliases = splitAliases(current.ALIAS ?? "");
		const aliasDiffers =
			currentAliases.some((alias) => !postedAliases.includes(alias)) ||
			postedAliases.some((alias) => !currentAliases.includes(alias));
		const dnsZone = aliasDiffers
			? await hestia.listDnsDomain(user, domain).catch(() => null)
			: null;
		const aliasPublicIp = dnsZone ? await hestia.publicIpFor(user, effectiveIp) : "";
		for (const alias of currentAliases) {
			if (!postedAliases.includes(alias)) {
				await hestia.deleteWebDomainAlias(user, domain, alias);
				if (dnsZone) {
					await hestia.deleteDnsOnWebAlias(user, domain, alias);
					dnsChanged = true;
				}
				changed = true;
			}
		}
		for (const alias of postedAliases) {
			if (!currentAliases.includes(alias)) {
				await hestia.addWebDomainAlias(user, domain, alias);
				if (dnsZone) {
					await hestia.addDnsOnWebAlias(user, alias, aliasPublicIp);
					dnsChanged = true;
				}
				changed = true;
			}
		}

		// Let's Encrypt on/off; removing a plain cert is separate
		const wantLe = formData.get("letsencrypt") === "yes";
		if (wantLe && current.LETSENCRYPT !== "yes") {
			await hestia.addLetsEncryptDomain(
				user,
				domain,
				postedAliases.join(","),
				String(formData.get("sslKeyAlgo") ?? ""),
			);
			changed = true;
		} else if (!wantLe && current.LETSENCRYPT === "yes") {
			await hestia.deleteLetsEncryptDomain(user, domain);
			changed = true;
		}
		if (
			formData.get("removeSsl") === "yes" &&
			current.SSL === "yes" &&
			current.LETSENCRYPT !== "yes"
		) {
			await hestia.deleteWebDomainSsl(user, domain);
			changed = true;
		}
		const sslOn = current.SSL === "yes" || (wantLe && current.LETSENCRYPT !== "yes");
		if (sslOn) {
			const force = formData.get("sslForce") === "yes";
			if (force !== (current.SSL_FORCE === "yes")) {
				await hestia.setWebDomainSslForce(user, domain, force);
				changed = true;
			}
			const hsts = formData.get("sslHsts") === "yes";
			if (hsts !== (current.SSL_HSTS === "yes")) {
				await hestia.setWebDomainSslHsts(user, domain, hsts);
				changed = true;
			}
		}

		// FastCGI / nginx cache
		const cache = formData.get("fastcgi") === "yes";
		const duration = String(formData.get("fastcgiDuration") ?? "").trim();
		if (cache && current.FASTCGI_CACHE !== "yes") {
			await hestia.addFastcgiCache(user, domain, duration || "5m");
			changed = true;
		} else if (!cache && current.FASTCGI_CACHE === "yes") {
			await hestia.deleteFastcgiCache(user, domain);
			changed = true;
		} else if (cache && duration && duration !== (current.FASTCGI_DURATION ?? "")) {
			await hestia.deleteFastcgiCache(user, domain);
			await hestia.addFastcgiCache(user, domain, duration);
			changed = true;
		}

		// Stats system
		const stats = String(formData.get("stats") ?? "");
		if (stats !== (current.STATS ?? "")) {
			await hestia.setWebDomainStats(user, domain, current.STATS ?? "", stats);
			changed = true;
		}

		if (changed) {
			await hestia.restartWeb();
			await hestia.restartProxy();
		}
		if (dnsChanged) {
			await hestia.restartDns();
		}
	} catch (error) {
		redirect(`${back}&error=${encodeURIComponent(errorMessage(error))}`);
	}
	redirect(`${back}&saved=1`);
}
