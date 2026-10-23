import Link from "next/link";
import { redirect } from "next/navigation";
import { hestia, requireSession } from "@/lib/panel";
import { disable2faAction, editUserAction, enable2faAction } from "./actions";

export default async function UserDetailPage({
	params,
	searchParams,
}: {
	params: Promise<{ user: string }>;
	searchParams: Promise<{ saved?: string; error?: string }>;
}) {
	const session = await requireSession();
	const { user } = await params;
	const query = await searchParams;
	const username = decodeURIComponent(user);
	// While impersonating, only the looked account's page is in scope.
	if (session.data.look && session.data.look !== username) {
		redirect(`/users/${encodeURIComponent(String(session.data.look))}`);
	}
	const isAdmin =
		session.data.userContext === "admin" && !session.data.look;
	const token = String(session.data.token ?? "");

	let record;
	try {
		record = await hestia.listUser(username);
	} catch {
		return (
			<div className="card">
				<h1>User not found</h1>
				<p className="error">No such user: {username}</p>
				<p>
					<Link href="/users">Back to users</Link>
				</p>
			</div>
		);
	}

	const [packages, languages, shells, themes] = await Promise.all([
		hestia.listUserPackages().catch(() => ({}) as Record<string, unknown>),
		hestia.listSysLanguages().catch(() => [] as string[]),
		hestia.listSysShells().catch(() => [] as string[]),
		hestia.listSysThemes().catch(() => [] as string[]),
	]);
	const [firstName, ...rest] = (record.NAME ?? "").split(" ");
	const lastName = rest.join(" ");
	const currentShell = (record.SHELL ?? "").split("/").pop() ?? "";

	return (
		<div>
			<h1>{username}</h1>
			{query.saved ? <p className="card">Saved.</p> : null}
			{query.error === "csrf" ? (
				<p className="error">Invalid form token. Please reload and try again.</p>
			) : query.error ? (
				<p className="error">{query.error}</p>
			) : null}
			<div className="card">
				<dl className="fields">
					<dt>Package</dt>
					<dd>{record.PACKAGE}</dd>
					<dt>Web domains</dt>
					<dd>{record.WEB_DOMAINS}</dd>
					<dt>DNS domains</dt>
					<dd>{record.DNS_DOMAINS}</dd>
					<dt>Mail domains</dt>
					<dd>{record.MAIL_DOMAINS}</dd>
					<dt>Databases</dt>
					<dd>{record.DATABASES}</dd>
					<dt>Cron jobs</dt>
					<dd>{record.CRON_JOBS}</dd>
					<dt>Disk quota</dt>
					<dd>{record.DISK_QUOTA}</dd>
					<dt>Suspended</dt>
					<dd>{record.SUSPENDED}</dd>
				</dl>
			</div>
			<div className="card" style={{ marginTop: "1rem" }}>
				<h2>Edit user</h2>
				<form action={editUserAction}>
					<input type="hidden" name="user" value={username} />
					<input type="hidden" name="token" value={token} />
					<label htmlFor="firstName">First name</label>
					<input id="firstName" name="firstName" defaultValue={firstName} />
					<label htmlFor="lastName">Last name</label>
					<input id="lastName" name="lastName" defaultValue={lastName} />
					<label htmlFor="email">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						defaultValue={record.CONTACT ?? ""}
					/>
					<label htmlFor="secret">New password (leave empty to keep)</label>
					<input
						id="secret"
						name="secret"
						type="password"
						autoComplete="new-password"
					/>
					{isAdmin ? (
						<>
							<label htmlFor="package">Package</label>
							<select id="package" name="package" defaultValue={record.PACKAGE}>
								{Object.keys(packages)
									.sort()
									.map((name) => (
										<option key={name} value={name}>
											{name}
										</option>
									))}
							</select>
							<label htmlFor="shell">Shell</label>
							<select id="shell" name="shell" defaultValue={currentShell}>
								{shells.map((shell) => (
									<option key={shell} value={shell}>
										{shell}
									</option>
								))}
							</select>
							<label htmlFor="role">Role</label>
							<select id="role" name="role" defaultValue={record.ROLE}>
								<option value="user">User</option>
								<option value="admin">Administrator</option>
							</select>
						</>
					) : null}
					<label htmlFor="language">Language</label>
					<select id="language" name="language" defaultValue={record.LANGUAGE}>
						{languages.map((lang) => (
							<option key={lang} value={lang}>
								{lang}
							</option>
						))}
					</select>
					<label htmlFor="theme">Theme</label>
					<select id="theme" name="theme" defaultValue={record.THEME ?? "default"}>
						{themes.map((theme) => (
							<option key={theme} value={theme}>
								{theme}
							</option>
						))}
					</select>
					<label htmlFor="ns">Nameservers (comma-separated)</label>
					<input id="ns" name="ns" defaultValue={record.NS ?? ""} />
					<label>
						<input
							type="checkbox"
							name="loginDisabled"
							value="yes"
							defaultChecked={record.LOGIN_DISABLED === "yes"}
						/>{" "}
						Disable login
					</label>
					<button type="submit" className="primary">
						Save
					</button>
				</form>
			</div>
			<div className="card" style={{ marginTop: "1rem" }}>
				<h2>Two-factor authentication</h2>
				{record.TWOFA ? (
					<>
						<p>
							2FA is <strong>enabled</strong> for this account. Secret:
						</p>
						<input readOnly value={record.TWOFA} style={{ width: "100%" }} />
						{record.QRCODE ? (
							<p>
								{/* QRCODE is a data-URI PNG produced by Hestia's own 2fa helper */}
								<img src={record.QRCODE} alt="2FA QR code" width={200} height={200} />
							</p>
						) : null}
						<form action={disable2faAction}>
							<input type="hidden" name="user" value={username} />
							<input type="hidden" name="token" value={token} />
							<button type="submit">Disable 2FA</button>
						</form>
					</>
				) : (
					<>
						<p>2FA is not enabled for this account.</p>
						<form action={enable2faAction}>
							<input type="hidden" name="user" value={username} />
							<input type="hidden" name="token" value={token} />
							<button type="submit">Enable 2FA</button>
						</form>
					</>
				)}
			</div>
			<p>
				<Link href="/users">Back to users</Link>
				{isAdmin ? (
					<>
						{" · "}
						<Link href={`/users/${encodeURIComponent(username)}/delete`}>
							Delete user
						</Link>
					</>
				) : null}
			</p>
		</div>
	);
}
