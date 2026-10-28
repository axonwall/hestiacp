import nodemailer from "nodemailer";

/**
 * Send one panel email (web/inc/main.php send_email, as generalized
 * from the reset flow): the server SMTP relay when the sys config
 * says USE_SERVER_SMTP=true (PHPMailer's SMTP branch, including the
 * SERVER_SMTP_ADDR from override), else the local sendmail binary
 * (PHPMailer's default branch). Body goes as text plus nl2br HTML,
 * as PHP does. Send failures are swallowed — PHP ignores PHPMailer
 * errors too, and the calling action reports success regardless.
 */
export async function sendMail(
	sys: Record<string, string>,
	opts: {
		to: string;
		toName?: string;
		subject: string;
		body: string;
		fromFallbackHost: string;
	},
): Promise<void> {
	const useSmtp = sys.USE_SERVER_SMTP === "true";
	const fromAddr = sys.FROM_EMAIL || `noreply@${opts.fromFallbackHost}`;
	const fromName = sys.FROM_NAME || sys.APP_NAME || "HestiaCP";
	let transporter: ReturnType<typeof nodemailer.createTransport>;
	if (useSmtp) {
		transporter = nodemailer.createTransport({
			host: sys.SERVER_SMTP_HOST,
			port: Number(sys.SERVER_SMTP_PORT) || 587,
			secure: sys.SERVER_SMTP_SECURITY === "ssl",
			auth: { user: sys.SERVER_SMTP_USER, pass: sys.SERVER_SMTP_PASSWD },
		});
	} else {
		transporter = nodemailer.createTransport({ sendmail: true });
	}
	const smtpFrom =
		useSmtp && sys.SERVER_SMTP_ADDR && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sys.SERVER_SMTP_ADDR)
			? sys.SERVER_SMTP_ADDR
			: fromAddr;
	try {
		await transporter.sendMail({
			from: `"${fromName}" <${smtpFrom}>`,
			to: opts.toName ? `"${opts.toName}" <${opts.to}>` : opts.to,
			subject: opts.subject,
			text: opts.body,
			html: opts.body.replace(/\n/g, "<br/>"),
		});
	} catch {
		// PHP ignores PHPMailer failures; the reply is "sent" either way.
	}
}
