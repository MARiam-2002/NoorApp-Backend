import { env, appConfig } from '../config';
import { logger } from './logger';

type EmailProvider = 'resend' | 'smtp' | 'mock';

interface SendEmailArgs {
  to: string;
  subject: string;
  html: string;
  text: string;
}

function hasResendCredentials(): boolean {
  return Boolean(env.RESEND_API_KEY?.trim());
}

function hasSmtpCredentials(): boolean {
  return Boolean(env.MAIL_USER?.trim() && env.MAIL_PASSWORD?.trim());
}

function hasEmailCredentials(): boolean {
  return hasResendCredentials() || hasSmtpCredentials();
}

/** Production/staging: mail is on whenever credentials exist. Local: only if MAIL_ENABLED=true. */
function isMailEffectivelyEnabled(): boolean {
  if (appConfig.isProduction || appConfig.isStaging) {
    return env.MAIL_ENABLED || hasEmailCredentials();
  }
  return env.MAIL_ENABLED;
}

function resolveMailFrom(): string {
  return env.MAIL_FROM?.trim() || '';
}

function isResendTestSender(from: string): boolean {
  const lower = from.toLowerCase();
  return lower.includes('@resend.dev');
}

function resolveProvider(): EmailProvider {
  if (!isMailEffectivelyEnabled()) return 'mock';

  const hasResend = hasResendCredentials();
  const hasSmtp = hasSmtpCredentials();

  if (env.EMAIL_PROVIDER === 'resend') return hasResend ? 'resend' : 'mock';
  if (env.EMAIL_PROVIDER === 'smtp') return hasSmtp ? 'smtp' : 'mock';

  if (hasResend) return 'resend';
  if (hasSmtp) return 'smtp';
  return 'mock';
}

function buildDeeplink(rawToken: string): string {
  const tpl = env.RESET_PASSWORD_DEEPLINK?.trim() || 'noorapp://auth/reset-password?token={{token}}';
  return tpl.replaceAll('{{token}}', encodeURIComponent(rawToken));
}

async function sendViaSmtp(payload: SendEmailArgs): Promise<boolean> {
  const from = resolveMailFrom();
  if (!from) {
    logger.error(
      '[Email] SMTP skipped: MAIL_FROM is empty. Use a sender you verified in Brevo (Senders, Domains & IPs). Do not use the SMTP login (@smtp-brevo.com) as From.',
    );
    return false;
  }
  if (from.toLowerCase().includes('@smtp-brevo.com')) {
    logger.error(
      '[Email] MAIL_FROM must not be the Brevo SMTP login. Use a verified sender address instead.',
    );
    return false;
  }
  if (!env.MAIL_USER?.trim() || !env.MAIL_PASSWORD?.trim()) {
    logger.error('[Email] SMTP skipped: MAIL_USER or MAIL_PASSWORD missing');
    return false;
  }
  if (env.MAIL_USER.trim().toLowerCase() === 'smtp-relay.brevo.com') {
    logger.error(
      '[Email] MAIL_USER must be the SMTP login from Brevo Settings → SMTP & API (xxx@smtp-brevo.com), not the relay host.',
    );
    return false;
  }

  const port = env.MAIL_PORT;
  const secure = env.MAIL_SECURE || port === 465;
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port,
    secure,
    requireTLS: !secure,
    auth: { user: env.MAIL_USER.trim(), pass: env.MAIL_PASSWORD },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });

  try {
    const info = await transporter.sendMail({
      from,
      to: payload.to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });

    logger.info('[Email] SMTP sent', {
      host: env.MAIL_HOST,
      port,
      messageId: info?.messageId,
    });
    return true;
  } finally {
    transporter.close();
  }
}

async function sendViaResend(payload: SendEmailArgs): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    logger.warn('[Email] RESEND_API_KEY missing; falling back to mock');
    return sendViaMock(payload, 'resend-unconfigured');
  }
  const from = resolveMailFrom();
  if (!from) {
    logger.error(
      '[Email] MAIL_FROM is required for Resend. Use an address on a domain verified at resend.com/domains. Do not use onboarding@resend.dev for real users — that sender can only deliver to the Resend account owner.',
    );
    return false;
  }
  if (isResendTestSender(from)) {
    logger.warn(
      '[Email] MAIL_FROM uses resend.dev (test sender). Resend will only deliver to the email on your Resend account, not to arbitrary production users.',
    );
  }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [payload.to],
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    logger.error('[Email] Resend failed', {
      status: res.status,
      to: payload.to,
      body: text.slice(0, 300),
    });
    return false;
  }

  const data = await res.json().catch(() => ({} as Record<string, unknown>));
  logger.info('[Email] Resend sent', {
    to: payload.to,
    id: (data as { id?: string }).id,
  });
  return true;
}

async function sendViaMock(payload: SendEmailArgs, reason = 'disabled'): Promise<boolean> {
  const snippet = {
    to: payload.to,
    subject: payload.subject,
    textPreview: payload.text.slice(0, 180),
    provider: resolveProvider(),
  };
  if (appConfig.isDevelopment) {
    logger.debug('[Email] MOCK delivery', { reason, ...snippet });
    return true;
  }
  logger.warn('[Email] MOCK delivery — email not sent', { reason, to: payload.to, subject: payload.subject });
  return false;
}

async function sendEmail(payload: SendEmailArgs): Promise<boolean> {
  const provider = resolveProvider();
  try {
    if (provider === 'resend') return await sendViaResend(payload);
    if (provider === 'smtp') return await sendViaSmtp(payload);
    return await sendViaMock(payload, 'provider=mock');
  } catch (err) {
    logger.error('[Email] sendEmail threw', {
      provider,
      to: payload.to,
      subject: payload.subject,
      err: (err as Error)?.message || String(err),
    });
    return false;
  }
}

export function buildPasswordResetPayload(rawToken: string, userEmail: string) {
  const deeplink = buildDeeplink(rawToken);
  const subject = 'إعادة تعيين كلمة مرور نور / Reset your Noor password';
  const brandGold = '#C9A86A';
  const brandNavy = '#1A1040';
  const brandCream = '#FAF8F3';
  const text = `
مرحباً،

طلبتِ إعادة تعيين كلمة المرور لحساب نور (${userEmail}).

انسخِ رمز إعادة التعيين إلى شاشة إعادة التعيين في التطبيق:
  ${rawToken}

أو افتحي الرابط من الهاتف المثبّت عليه نور:
  ${deeplink}

الرمز ينتهي خلال ساعة. إن لم تطلبي هذا، تجاهلي الرسالة.

Hello,

You requested a password reset for your Noor account (${userEmail}).

Copy this reset token into the Noor app reset screen:
  ${rawToken}

Or open this deep link from the phone that has Noor installed:
  ${deeplink}

This token expires in 1 hour. If you did not request this, ignore this email.

— Noor
  `.trim();

  const html = `
<!doctype html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${subject}</title>
  </head>
  <body style="margin:0;padding:0;background:${brandCream};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Tahoma,Arial,sans-serif;color:${brandNavy};">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${brandCream};">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;background:#ffffff;border:1px solid #ece9df;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:${brandNavy};padding:22px 24px;text-align:right;">
                <div style="color:${brandGold};font-weight:700;font-size:20px;">نور</div>
                <div style="color:#e7e0d0;font-size:13px;margin-top:4px;">طلب إعادة تعيين كلمة المرور</div>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;text-align:right;">
                <p style="margin:0 0 16px;font-size:15px;line-height:1.8;">مرحباً،</p>
                <p style="margin:0 0 18px;font-size:15px;line-height:1.8;">
                  طلبتِ إعادة تعيين كلمة المرور لحساب
                  <strong style="color:${brandNavy};">${userEmail}</strong>.
                </p>
                <div style="background:${brandCream};border:1px dashed #d8cfb8;border-radius:12px;padding:16px;margin:0 0 18px;text-align:left;direction:ltr;">
                  <div style="font-size:12px;color:#6b6156;margin-bottom:8px;">Reset token / رمز إعادة التعيين</div>
                  <div style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:14px;word-break:break-all;color:${brandNavy};background:#ffffff;padding:10px 12px;border-radius:8px;border:1px solid #ece9df;">
                    ${rawToken}
                  </div>
                </div>
                <div style="margin:0 0 18px;">
                  <a href="${deeplink}"
                     style="display:inline-block;background:${brandGold};color:${brandNavy};text-decoration:none;font-weight:600;padding:12px 18px;border-radius:10px;">
                    فتح شاشة إعادة التعيين في نور
                  </a>
                </div>
                <p style="margin:0 0 8px;font-size:13px;line-height:1.8;color:#5a5249;">
                  إذا لم يعمل الزر، انسخِ الرابط وافتحيه من الهاتف المثبّت عليه نور:
                </p>
                <div style="word-break:break-all;font-size:12px;color:#5a5249;background:#fff7ea;padding:10px 12px;border-radius:8px;border:1px solid #f1e7ce;margin:0 0 18px;text-align:left;direction:ltr;">
                  ${deeplink}
                </div>
                <p style="margin:0;font-size:13px;line-height:1.8;color:#5a5249;">
                  الرمز ينتهي خلال <strong>ساعة واحدة</strong>. إن لم تطلبي هذا، تجاهلي الرسالة.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 24px;background:${brandCream};border-top:1px solid #ece9df;color:#6b6156;font-size:12px;text-align:center;">
                — نور
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
  `.trim();

  return {
    to: userEmail,
    subject,
    text,
    html,
    deeplink,
  };
}

export async function sendPasswordResetEmail(rawToken: string, userEmail: string): Promise<{ sent: boolean; provider: EmailProvider | 'mock'; deeplink: string }> {
  const provider = resolveProvider();
  const payload = buildPasswordResetPayload(rawToken, userEmail);
  const sent = await sendEmail({ to: payload.to, subject: payload.subject, text: payload.text, html: payload.html });
  return { sent, provider, deeplink: payload.deeplink };
}

export function getEmailProviderStatus() {
  const from = resolveMailFrom();
  return {
    provider: resolveProvider(),
    mailEnabled: env.MAIL_ENABLED,
    mailEffectivelyEnabled: isMailEffectivelyEnabled(),
    hasResendKey: hasResendCredentials(),
    hasSmtpAuth: hasSmtpCredentials(),
    hasMailFrom: Boolean(from),
    usesResendTestSender: isResendTestSender(from),
    resetDeeplinkTemplate: env.RESET_PASSWORD_DEEPLINK?.trim() || '',
  };
}
