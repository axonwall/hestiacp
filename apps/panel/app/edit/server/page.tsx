import Link from "next/link";
import { RowActionButton } from "@/components/RowAction";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import {
	addBackupHostAction,
	deleteBackupHostAction,
	editServerApiAction,
	editServerDbAction,
	editServerFeaturesAction,
	editServerPhpAction,
	editServerPoliciesAction,
	editServerProtectionAction,
	editServerSecurityAction,
	editServerSettingsAction,
	editServerSmtpAction,
	editServerSslAction,
	editServerWebmailAction,
	saveBackupHostResticAction,
} from "./actions";
import { PHP_VERSIONS } from "./phpVersions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const [sys, timezones, languages, themes, backupHosts, sslInfo, dnsHosts, phpInstalled, dbHosts] =
		await Promise.all([
			hestia
				.listSysConfig()
				.then((r) => r.config ?? {})
				.catch(() => ({}) as Record<string, string>),
			hestia.getSysTimezones().catch(() => [] as string[]),
			hestia.listSysLanguages().catch(() => [] as string[]),
			hestia.listSysThemes().catch(() => [] as string[]),
			hestia.listBackupHosts().catch(() => ({})),
			hestia.listSysHestiaSsl().catch(() => null),
			hestia.listRemoteDnsHosts().catch(() => ({})),
			hestia.listSysPhp().catch(() => [] as string[]),
			hestia.listDatabaseHosts().catch(() => ({})),
		]);
	const token = String(session.data.token ?? "");
	const isRoot =
		!!sys.ROOT_USER && session.data.user !== undefined && session.data.user === sys.ROOT_USER;
	const ssl = sslInfo?.HESTIA ?? {};
	const trimQuotes = (s: string) => s.replace(/^'+|'+$/g, "");
	const dnsClusterYes = Object.keys(dnsHosts).length > 0;
	const hasMysql = Object.values(dbHosts).some((row) => row.TYPE === "mysql");
	const hasPgsql = Object.values(dbHosts).some((row) => row.TYPE === "pgsql");
	const phpDefault = [...PHP_VERSIONS].reverse().find((v) => phpInstalled.includes(v)) ?? "";
	return (
		<div className="card">
			<h1>{t("Server settings")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p className="ok">Changes have been saved.</p> : null}

			<h2>{t("Basic")}</h2>
			<form action={editServerSettingsAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvHostname">{t("Hostname")}</label>
				<input
					className="form-control"
					id="srvHostname"
					name="hostname"
					defaultValue={sys.HOSTNAME ?? ""}
				/>
				<label htmlFor="srvTimezone">{t("Timezone")}</label>
				<select
					className="form-select"
					id="srvTimezone"
					name="timezone"
					defaultValue={sys.TIMEZONE ?? "UTC"}
				>
					{timezones.map((tz) => (
						<option key={tz} value={tz}>
							{tz}
						</option>
					))}
				</select>
				<label htmlFor="srvLanguage">{t("Default language")}</label>
				<select
					className="form-select"
					id="srvLanguage"
					name="language"
					defaultValue={sys.LANGUAGE ?? "en"}
				>
					{languages.map((lang) => (
						<option key={lang} value={lang}>
							{lang}
						</option>
					))}
				</select>
				<label>
					<input type="checkbox" name="languageUpdateUsers" value="yes" />{" "}
					{t("Apply the language to all users")}
				</label>
				<label htmlFor="srvTheme">{t("Theme")}</label>
				<select
					className="form-select"
					id="srvTheme"
					name="theme"
					defaultValue={sys.THEME ?? "default"}
				>
					{themes.map((theme) => (
						<option key={theme} value={theme}>
							{theme}
						</option>
					))}
				</select>
				<label htmlFor="srvBranch">{t("Release branch")}</label>
				<input
					className="form-control"
					id="srvBranch"
					name="releaseBranch"
					defaultValue={sys.RELEASE_BRANCH ?? ""}
				/>
				<label htmlFor="srvBackupMode">{t("Backup mode")}</label>
				<select
					className="form-select"
					id="srvBackupMode"
					name="backupMode"
					defaultValue={sys.BACKUP_MODE ?? "gzip"}
				>
					<option value="gzip">gzip</option>
					<option value="zstd">zstd</option>
				</select>
				<label htmlFor="srvBackupGzip">{t("Backup compression level")}</label>
				<input
					className="form-control"
					id="srvBackupGzip"
					name="backupGzip"
					defaultValue={sys.BACKUP_GZIP ?? ""}
				/>
				<label htmlFor="srvBackupDir">{t("Backup directory")}</label>
				<input
					className="form-control"
					id="srvBackupDir"
					name="backupDir"
					defaultValue={sys.BACKUP ?? ""}
				/>
				<label>
					<input
						type="checkbox"
						name="debugMode"
						value="yes"
						defaultChecked={sys.DEBUG_MODE === "yes"}
					/>{" "}
					{t("Debug mode")}
				</label>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			<h2>{t("Features")}</h2>
			<form action={editServerFeaturesAction}>
				<input type="hidden" name="token" value={token} />
				<label>
					<input
						type="checkbox"
						name="firewall"
						value="yes"
						defaultChecked={!!sys.FIREWALL_SYSTEM}
					/>{" "}
					{t("Firewall")}
				</label>
				<label>
					<input
						type="checkbox"
						name="fileManager"
						value="yes"
						defaultChecked={sys.FILE_MANAGER === "true"}
					/>{" "}
					{t("File manager")}
				</label>
				<label>
					<input
						type="checkbox"
						name="webTerminal"
						value="yes"
						defaultChecked={sys.WEB_TERMINAL === "true"}
					/>{" "}
					{t("Web terminal")}
				</label>
				<label>
					<input type="checkbox" name="quota" value="yes" defaultChecked={!!sys.QUOTA_SYSTEM} />{" "}
					{t("Disk quota")}
				</label>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			<h2>{t("Security")}</h2>
			<form action={editServerSecurityAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvLoginStyle">{t("Login screen style")}</label>
				<select
					className="form-select"
					id="srvLoginStyle"
					name="loginStyle"
					defaultValue={sys.LOGIN_STYLE ?? "default"}
				>
					<option value="default">{t("Default")}</option>
					<option value="old">{t("Old")}</option>
				</select>
				<label htmlFor="srvTimeout">
					{t("Inactive session timeout")} ({t("Minutes")})
				</label>
				<input
					className="form-control"
					id="srvTimeout"
					name="inactiveTimeout"
					defaultValue={sys.INACTIVE_SESSION_TIMEOUT ?? ""}
				/>
				<label htmlFor="srvCsrf">{t("Prevent CSRF")}</label>
				<select
					className="form-select"
					id="srvCsrf"
					name="csrfStrictness"
					defaultValue={sys.POLICY_CSRF_STRICTNESS ?? "0"}
				>
					<option value="0">{t("Disabled")}</option>
					<option value="1">{t("Enabled")}</option>
					<option value="2">{t("Strict")}</option>
				</select>
				<label htmlFor="srvEnforce">{t("Enforce subdomain ownership")}</label>
				<select
					className="form-select"
					id="srvEnforce"
					name="enforceSubdomain"
					defaultValue={sys.ENFORCE_SUBDOMAIN_OWNERSHIP ?? "no"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label>
					<input
						type="checkbox"
						name="experimental"
						value="on"
						defaultChecked={sys.POLICY_SYSTEM_ENABLE_BACON === "true"}
					/>{" "}
					{t("Enable preview features")}
				</label>
				<label htmlFor="srvPlugin">{t("Quick App Installer")}</label>
				<select
					className="form-select"
					id="srvPlugin"
					name="pluginInstaller"
					defaultValue={sys.PLUGIN_APP_INSTALLER ?? "true"}
				>
					<option value="true">{t("Yes")}</option>
					<option value="false">{t("No")}</option>
				</select>
				<label htmlFor="srvResources">{t("Limit System Resources")}</label>
				<select
					className="form-select"
					id="srvResources"
					name="resourcesLimit"
					defaultValue={sys.RESOURCES_LIMIT ?? "no"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvPmaKey">{t("phpMyAdmin Single Sign On")}</label>
				<select
					className="form-select"
					id="srvPmaKey"
					name="pmaKey"
					defaultValue={sys.PHPMYADMIN_KEY ? "yes" : "no"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvPmaRestrict">{t("Restrict phpMyAdmin access")}</label>
				<select
					className="form-select"
					id="srvPmaRestrict"
					name="pmaRestrict"
					defaultValue={sys.PMA_RESTRICT_ACCESS ?? "no"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label>
					<input
						type="checkbox"
						name="upgradeNotify"
						value="on"
						defaultChecked={sys.UPGRADE_SEND_EMAIL === "true"}
					/>{" "}
					{t("Send email notification when an update is available")}
				</label>
				<label>
					<input
						type="checkbox"
						name="upgradeLog"
						value="on"
						defaultChecked={sys.UPGRADE_SEND_EMAIL_LOG === "true"}
					/>{" "}
					{t("Send email notification when an update has been installed")}
				</label>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			{isRoot ? (
				<>
					<h2>{t("System Protection")}</h2>
					<form action={editServerProtectionAction}>
						<input type="hidden" name="token" value={token} />
						<label htmlFor="srvProtectedAdmin">
							{t("Restrict access to read-only for other administrators")}
						</label>
						<select
							className="form-select"
							id="srvProtectedAdmin"
							name="protectedAdmin"
							defaultValue={sys.POLICY_SYSTEM_PROTECTED_ADMIN ?? "no"}
						>
							<option value="yes">{t("Yes")}</option>
							<option value="no">{t("No")}</option>
						</select>
						<label htmlFor="srvHideAdmin">{t("Hide account from other administrators")}</label>
						<select
							className="form-select"
							id="srvHideAdmin"
							name="hideAdmin"
							defaultValue={sys.POLICY_SYSTEM_HIDE_ADMIN ?? "no"}
						>
							<option value="yes">{t("Yes")}</option>
							<option value="no">{t("No")}</option>
						</select>
						<label htmlFor="srvHideServices">
							{t("Do not allow other administrators to access Server Settings")}
						</label>
						<select
							className="form-select"
							id="srvHideServices"
							name="hideServices"
							defaultValue={sys.POLICY_SYSTEM_HIDE_SERVICES ?? "no"}
						>
							<option value="yes">{t("Yes")}</option>
							<option value="no">{t("No")}</option>
						</select>
						<button type="submit" className="button">
							{t("Save")}
						</button>
					</form>
				</>
			) : null}

			<h2>{t("Policies")}</h2>
			<form action={editServerPoliciesAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvEditDetails">{t("Allow users to edit their account details")}</label>
				<select
					className="form-select"
					id="srvEditDetails"
					name="editDetails"
					defaultValue={sys.POLICY_USER_EDIT_DETAILS ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvEditWeb">{t("Allow users to edit web templates")}</label>
				<select
					className="form-select"
					id="srvEditWeb"
					name="editWebTemplates"
					defaultValue={sys.POLICY_USER_EDIT_WEB_TEMPLATES ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvEditDns">{t("Allow users to edit DNS templates")}</label>
				<select
					className="form-select"
					id="srvEditDns"
					name="editDnsTemplates"
					defaultValue={sys.POLICY_USER_EDIT_DNS_TEMPLATES ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvViewLogs">{t("Allow users to view logs")}</label>
				<select
					className="form-select"
					id="srvViewLogs"
					name="viewLogs"
					defaultValue={sys.POLICY_USER_VIEW_LOGS ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvDeleteLogs">{t("Allow users to delete logs")}</label>
				<select
					className="form-select"
					id="srvDeleteLogs"
					name="deleteLogs"
					defaultValue={sys.POLICY_USER_DELETE_LOGS ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvViewSuspended">
					{t("Allow suspended users to log in with read-only access")}
				</label>
				<select
					className="form-select"
					id="srvViewSuspended"
					name="viewSuspended"
					defaultValue={sys.POLICY_USER_VIEW_SUSPENDED ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvBackupSuspended">
					{t("Allow suspended users to create new backups")}
				</label>
				<select
					className="form-select"
					id="srvBackupSuspended"
					name="backupSuspended"
					defaultValue={sys.POLICY_USER_BACKUP_SUSPENDED_USERS ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvSyncError">{t("Sync Error document templates on user rebuild")}</label>
				<select
					className="form-select"
					id="srvSyncError"
					name="syncErrorDocuments"
					defaultValue={sys.POLICY_SYNC_ERROR_DOCUMENTS ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvSyncSkeleton">{t("Sync Skeleton templates")}</label>
				<select
					className="form-select"
					id="srvSyncSkeleton"
					name="syncSkeleton"
					defaultValue={sys.POLICY_SYNC_SKELETON ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label>
					<input
						type="checkbox"
						name="changeTheme"
						value="on"
						defaultChecked={sys.POLICY_USER_CHANGE_THEME === "no"}
					/>{" "}
					{t("Set as selected theme for all users")}
				</label>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			<h2>{t("API")}</h2>
			<form action={editServerApiAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvApiSystem">{t("Enable API access")}</label>
				<select
					className="form-select"
					id="srvApiSystem"
					name="apiSystem"
					defaultValue={sys.API_SYSTEM ?? "0"}
				>
					<option value="0">{t("Disabled")}</option>
					<option value="1">{t("Enabled for admin")}</option>
					<option value="2">{t("Enabled for all users")}</option>
				</select>
				<label htmlFor="srvLegacyApi">{t("Enable legacy API access")}</label>
				<select
					className="form-select"
					id="srvLegacyApi"
					name="legacyApi"
					defaultValue={sys.API ?? "yes"}
				>
					<option value="yes">{t("Yes")}</option>
					<option value="no">{t("No")}</option>
				</select>
				<label htmlFor="srvAllowedIps">{t("Allowed IP addresses for API")}</label>
				<textarea
					className="form-control"
					id="srvAllowedIps"
					name="allowedIps"
					defaultValue={(sys.API_ALLOWED_IP ?? "").split(",").filter(Boolean).join("\n")}
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			<h2>{t("SMTP relay")}</h2>
			<form action={editServerSmtpAction}>
				<input type="hidden" name="token" value={token} />
				<label>
					<input type="checkbox" name="smtpRelay" value="yes" defaultChecked={!!sys.SMTP_RELAY} />{" "}
					{t("Enable SMTP relay")}
				</label>
				<label htmlFor="srvSmtpHost">{t("SMTP host")}</label>
				<input
					className="form-control"
					id="srvSmtpHost"
					name="smtpHost"
					defaultValue={sys.SMTP_RELAY_HOST ?? ""}
				/>
				<label htmlFor="srvSmtpPort">{t("SMTP port")}</label>
				<input
					className="form-control"
					id="srvSmtpPort"
					name="smtpPort"
					defaultValue={sys.SMTP_RELAY_PORT ?? ""}
				/>
				<label htmlFor="srvSmtpUser">{t("SMTP username")}</label>
				<input
					className="form-control"
					id="srvSmtpUser"
					name="smtpUser"
					defaultValue={sys.SMTP_RELAY_USER ?? ""}
				/>
				<label htmlFor="srvSmtpPass">{t("SMTP password")}</label>
				<input
					className="form-control"
					id="srvSmtpPass"
					name="smtpPass"
					type="password"
					autoComplete="new-password"
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			{sys.WEBMAIL_SYSTEM ? (
				<>
					<h2>{t("Webmail")}</h2>
					<form action={editServerWebmailAction}>
						<input type="hidden" name="token" value={token} />
						<label htmlFor="srvWebmailAlias">{t("Webmail Alias")}</label>
						<input
							className="form-control"
							id="srvWebmailAlias"
							name="webmailAlias"
							defaultValue={sys.WEBMAIL_ALIAS ?? ""}
						/>
						<button type="submit" className="button">
							{t("Save")}
						</button>
					</form>
				</>
			) : null}

			{hasMysql || hasPgsql ? (
				<>
					<h2>{t("Database")}</h2>
					<form action={editServerDbAction}>
						<input type="hidden" name="token" value={token} />
						{hasMysql ? (
							<>
								<label htmlFor="srvPmaAlias">{t("phpMyAdmin URL")}</label>
								<input
									className="form-control"
									id="srvPmaAlias"
									name="pmaAlias"
									defaultValue={sys.DB_PMA_ALIAS ?? ""}
								/>
								<label htmlFor="srvMysqlPass">{t("MySQL root password")}</label>
								<input
									className="form-control"
									id="srvMysqlPass"
									name="mysqlPassword"
									type="password"
									autoComplete="new-password"
								/>
							</>
						) : null}
						{hasPgsql ? (
							<>
								<label htmlFor="srvPgaAlias">{t("phpPgAdmin URL")}</label>
								<input
									className="form-control"
									id="srvPgaAlias"
									name="pgaAlias"
									defaultValue={sys.DB_PGA_ALIAS ?? ""}
								/>
							</>
						) : null}
						<button type="submit" className="button">
							{t("Save")}
						</button>
					</form>
				</>
			) : null}

			<h2>{t("Server SSL certificate")}</h2>
			<form action={editServerSslAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvSslCrt">{t("SSL Certificate")}</label>
				<textarea
					className="form-control"
					id="srvSslCrt"
					name="sslCrt"
					defaultValue={trimQuotes(ssl.CRT ?? "")}
				/>
				<label htmlFor="srvSslKey">{t("SSL Private Key")}</label>
				<textarea
					className="form-control"
					id="srvSslKey"
					name="sslKey"
					defaultValue={trimQuotes(ssl.KEY ?? "")}
				/>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>
			{ssl.SUBJECT ? (
				<ul>
					<li>
						{t("Subject")}: {ssl.SUBJECT}
					</li>
					{ssl.ALIASES ? (
						<li>
							{t("Aliases")}: {ssl.ALIASES}
						</li>
					) : null}
					{ssl.ISSUER ? (
						<li>
							{t("Issuer")}: {ssl.ISSUER}
						</li>
					) : null}
					{ssl.NOT_BEFORE ? (
						<li>
							{t("Valid from")}: {ssl.NOT_BEFORE}
						</li>
					) : null}
					{ssl.NOT_AFTER ? (
						<li>
							{t("Valid until")}: {ssl.NOT_AFTER}
						</li>
					) : null}
				</ul>
			) : null}
			<p>
				<a
					href={`/generate/ssl/?domain=${encodeURIComponent(sys.HOSTNAME ?? "")}`}
					target="_blank"
					rel="noopener"
				>
					{t("Generate Self-Signed SSL Certificate")}
				</a>
			</p>

			{sys.DNS_SYSTEM ? (
				<>
					<h2>{t("DNS")}</h2>
					<p>
						{sys.DNS_SYSTEM}{" "}
						<Link href={`/edit/server/service?service=${encodeURIComponent(sys.DNS_SYSTEM)}`}>
							{t("Edit")}
						</Link>
					</p>
					<p>
						{t("DNS Cluster")}: {dnsClusterYes ? t("Yes") : t("No")}
					</p>
					{Object.keys(dnsHosts).map((host, i) => (
						<div key={host}>
							<label htmlFor={`srvDnsHost${i}`}>
								{t("Host")} #{i + 1}
							</label>
							<input
								className="form-control"
								id={`srvDnsHost${i}`}
								name="dnsRemoteHost"
								defaultValue={host}
								disabled
							/>
						</div>
					))}
				</>
			) : null}

			{sys.WEB_BACKEND === "php-fpm" ? (
				<>
					<h2>{t("PHP versions")}</h2>
					<form action={editServerPhpAction}>
						<input type="hidden" name="token" value={token} />
						{PHP_VERSIONS.map((version) => (
							<label key={version}>
								<input
									type="checkbox"
									name="phpVersions"
									value={version}
									defaultChecked={phpInstalled.includes(version)}
								/>{" "}
								{`php-${version}`}
							</label>
						))}
						<label htmlFor="srvPhpDefault">{t("Default PHP version")}</label>
						<select
							className="form-select"
							id="srvPhpDefault"
							name="phpDefault"
							defaultValue={phpDefault}
						>
							{PHP_VERSIONS.map((version) => (
								<option key={version} value={version}>
									{`php-${version}`}
								</option>
							))}
						</select>
						<button type="submit" className="button">
							{t("Save")}
						</button>
					</form>
				</>
			) : null}

			<h2>{t("Remote backup hosts")}</h2>
			<ul>
				{Object.entries(backupHosts).map(([key, host]) => (
					<li key={key}>
						{key}: {host.HOST} ({host.USERNAME}) {host.PATH} :{host.PORT}{" "}
						<form action={deleteBackupHostAction} style={{ display: "inline" }}>
							<input type="hidden" name="token" value={token} />
							<input type="hidden" name="type" value={key} />
							<RowActionButton title={t("Delete")} icon="fa-trash icon-red" />
						</form>
					</li>
				))}
			</ul>
			<form action={addBackupHostAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="bhType">{t("Type")}</label>
				<select className="form-select" id="bhType" name="type" defaultValue="sftp">
					<option value="ftp">FTP</option>
					<option value="sftp">SFTP</option>
					<option value="b2">B2</option>
					<option value="rclone">Rclone</option>
				</select>
				<label htmlFor="bhHost">{t("Host")}</label>
				<input className="form-control" id="bhHost" name="host" />
				<label htmlFor="bhUser">{t("Username")}</label>
				<input className="form-control" id="bhUser" name="username" />
				<label htmlFor="bhPass">{t("Password / key")}</label>
				<input
					className="form-control"
					id="bhPass"
					name="secret"
					type="password"
					autoComplete="new-password"
				/>
				<label htmlFor="bhPath">{t("Path")}</label>
				<input className="form-control" id="bhPath" name="path" />
				<label htmlFor="bhPort">{t("Port")}</label>
				<input className="form-control" id="bhPort" name="port" />
				<label htmlFor="bhBucket">{t("Bucket (B2 only)")}</label>
				<input className="form-control" id="bhBucket" name="bucket" />
				<label htmlFor="bhAppId">{t("Application ID (B2 only)")}</label>
				<input className="form-control" id="bhAppId" name="appId" />
				<label htmlFor="bhAppKey">{t("Application key (B2 only)")}</label>
				<input
					className="form-control"
					id="bhAppKey"
					name="appKey"
					type="password"
					autoComplete="new-password"
				/>
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>

			<h2>{t("Incremental backups (restic)")}</h2>
			<form action={saveBackupHostResticAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="rsRepo">{t("Repository")}</label>
				<input
					className="form-control"
					id="rsRepo"
					name="repo"
					placeholder="sftp:user@host:/repo"
				/>
				<label htmlFor="rsSnapshots">{t("Snapshots")}</label>
				<input className="form-control" id="rsSnapshots" name="snapshots" defaultValue="10" />
				<label htmlFor="rsDaily">{t("Keep daily")}</label>
				<input className="form-control" id="rsDaily" name="keepDaily" defaultValue="7" />
				<label htmlFor="rsWeekly">{t("Keep weekly")}</label>
				<input className="form-control" id="rsWeekly" name="keepWeekly" defaultValue="4" />
				<label htmlFor="rsMonthly">{t("Keep monthly")}</label>
				<input className="form-control" id="rsMonthly" name="keepMonthly" defaultValue="6" />
				<label htmlFor="rsYearly">{t("Keep yearly")}</label>
				<input className="form-control" id="rsYearly" name="keepYearly" defaultValue="2" />
				<label>
					<input type="checkbox" name="remove" value="yes" />{" "}
					{t("Remove the restic backup host instead")}
				</label>
				<button type="submit" className="button">
					{t("Save")}
				</button>
			</form>

			<p>
				<Link href="/list/server">← {t("Services")}</Link>
			</p>
		</div>
	);
}
