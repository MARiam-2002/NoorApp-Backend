import nodemailer from 'nodemailer';
import { env } from '../src/config';
import { getEmailProviderStatus } from '../src/lib/email';

async function main() {
  const status = getEmailProviderStatus();
  process.stdout.write(
    `${JSON.stringify({
      provider: status.provider,
      mailEnabled: status.mailEnabled,
      mailEffectivelyEnabled: status.mailEffectivelyEnabled,
      hasSmtpAuth: status.hasSmtpAuth,
      hasMailFrom: status.hasMailFrom,
      host: env.MAIL_HOST,
      port: env.MAIL_PORT,
      userIsBrevoLogin: /@smtp-brevo\.com$/i.test(env.MAIL_USER),
      fromIsNotSmtpLogin: !/@smtp-brevo\.com/i.test(env.MAIL_FROM),
    })}\n`,
  );

  const transporter = nodemailer.createTransport({
    host: env.MAIL_HOST,
    port: env.MAIL_PORT,
    secure: env.MAIL_SECURE,
    requireTLS: !env.MAIL_SECURE,
    auth: { user: env.MAIL_USER, pass: env.MAIL_PASSWORD },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 20_000,
  });

  try {
    await transporter.verify();
    process.stdout.write('smtp_verify=OK\n');
  } catch (err) {
    process.stdout.write('smtp_verify=FAIL\n');
    process.stdout.write(`smtp_error=${(err as Error).message}\n`);
    process.exitCode = 1;
  } finally {
    transporter.close();
  }
}

void main();
