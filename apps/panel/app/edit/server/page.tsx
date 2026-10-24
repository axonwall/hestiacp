import Link from "next/link";
import { getT, hestia, requireAdmin } from "@/lib/panel";
import {
	addBackupHostAction,
	deleteBackupHostAction,
	editServerFeaturesAction,
	editServerSettingsAction,
	saveBackupHostResticAction,
} from "./actions";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ error?: string; saved?: string }>;
}) {
	const session = await requireAdmin();
	const t = await getT();
	const query = await searchParams;
	const [sys, timezones, languages, themes, backupHosts] = await Promise.all([
		hestia.listSysConfig().then((r) => r.config ?? {}).catch(() => ({}) as Record<string, string>),
		hestia.getSysTimezones().catch(() => [] as string[]),
		hestia.listSysLanguages().catch(() => [] as string[]),
		hestia.listSysThemes().catch(() => [] as string[]),
		hestia.listBackupHosts().catch(() => ({})),
	]);
	const token = String(session.data.token ?? "");
	return (
		<div className="card">
			<h1>{t("Server settings")}</h1>
			{query.error ? <p className="error">{query.error}</p> : null}
			{query.saved ? <p className="ok">Changes have been saved.</p> : null}

			<h2>{t("Basic")}</h2>
			<form action={editServerSettingsAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="srvHostname">{t("Hostname")}</label>
				<input className="form-control" id="srvHostname" name="hostname" defaultValue={sys.HOSTNAME ?? ""} />
				<label htmlFor="srvTimezone">{t("Timezone")}</label>
				<select className="form-select" id="srvTimezone" name="timezone" defaultValue={sys.TIMEZONE ?? "UTC"}>
					{timezones.map((tz) => (
						<option key={tz} value={tz}>
							{tz}
						</option>
					))}
				</select>
				<label htmlFor="srvLanguage">{t("Default language")}</label>
				<select className="form-select" id="srvLanguage" name="language" defaultValue={sys.LANGUAGE ?? "en"}>
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
				<select className="form-select" id="srvTheme" name="theme" defaultValue={sys.THEME ?? "default"}>
					{themes.map((theme) => (
						<option key={theme} value={theme}>
							{theme}
						</option>
					))}
				</select>
				<label htmlFor="srvBranch">{t("Release branch")}</label>
				<input className="form-control" id="srvBranch" name="releaseBranch" defaultValue={sys.RELEASE_BRANCH ?? ""} />
				<label htmlFor="srvBackupMode">{t("Backup mode")}</label>
				<select className="form-select" id="srvBackupMode" name="backupMode" defaultValue={sys.BACKUP_MODE ?? "gzip"}>
					<option value="gzip">gzip</option>
					<option value="zstd">zstd</option>
				</select>
				<label htmlFor="srvBackupGzip">{t("Backup compression level")}</label>
				<input className="form-control" id="srvBackupGzip" name="backupGzip" defaultValue={sys.BACKUP_GZIP ?? ""} />
				<label htmlFor="srvBackupDir">{t("Backup directory")}</label>
				<input className="form-control" id="srvBackupDir" name="backupDir" defaultValue={sys.BACKUP ?? ""} />
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
					<input type="checkbox" name="firewall" value="yes" defaultChecked={!!sys.FIREWALL_SYSTEM} />{" "}
					{t("Firewall")}
				</label>
				<label>
					<input type="checkbox" name="fileManager" value="yes" defaultChecked={sys.FILE_MANAGER === "true"} />{" "}
					{t("File manager")}
				</label>
				<label>
					<input type="checkbox" name="webTerminal" value="yes" defaultChecked={sys.WEB_TERMINAL === "true"} />{" "}
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

			<h2>{t("Remote backup hosts")}</h2>
			<ul>
				{Object.entries(backupHosts).map(([key, host]) => (
					<li key={key}>
						{key}: {host.HOST} ({host.USERNAME}) {host.PATH} :{host.PORT}{" "}
						<form action={deleteBackupHostAction} style={{ display: "inline" }}>
							<input type="hidden" name="token" value={token} />
							<input type="hidden" name="type" value={key} />
							<button type="submit" className="link-button">
								{t("Delete")}
							</button>
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
				</select>
				<label htmlFor="bhHost">{t("Host")}</label>
				<input className="form-control" id="bhHost" name="host" />
				<label htmlFor="bhUser">{t("Username")}</label>
				<input className="form-control" id="bhUser" name="username" />
				<label htmlFor="bhPass">{t("Password / key")}</label>
				<input className="form-control" id="bhPass" name="secret" type="password" autoComplete="new-password" />
				<label htmlFor="bhPath">{t("Path")}</label>
				<input className="form-control" id="bhPath" name="path" />
				<label htmlFor="bhPort">{t("Port")}</label>
				<input className="form-control" id="bhPort" name="port" />
				<button type="submit" className="button">
					{t("Add")}
				</button>
			</form>

			<h2>{t("Incremental backups (restic)")}</h2>
			<form action={saveBackupHostResticAction}>
				<input type="hidden" name="token" value={token} />
				<label htmlFor="rsRepo">{t("Repository")}</label>
				<input className="form-control" id="rsRepo" name="repo" placeholder="sftp:user@host:/repo" />
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
