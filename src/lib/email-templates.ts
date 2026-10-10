import { env } from '../config';
function escapeHtml(value: string) { return value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function origin() { try { const url=new URL(env.PUBLIC_APP_ORIGIN || 'https://noorapp-backend-production.up.railway.app');return url.protocol==='https:' ? url.origin : 'https://noorapp-backend-production.up.railway.app'; }catch{return 'https://noorapp-backend-production.up.railway.app';} }
export function buildVerificationEmailPayload(code: string, to: string) {
 if(!/^\d{6}$/.test(code))throw new Error('Invalid verification code');
 const base=escapeHtml(origin());
 const text='نور — تأكيد بريدك الإلكتروني\n\nأدخل هذا الرمز في تطبيق نور لإكمال إنشاء حسابك: '+code+'\nالرمز صالح لمدة ١٠ دقائق. لا تشاركه مع أي شخص. إذا لم تطلب إنشاء حساب، تجاهل الرسالة.\n\nNoor — Verify your email\nEnter this code in Noor to complete registration: '+code+'\nValid for 10 minutes. Never share this code. If you did not request an account, ignore this email.';
 const html=`<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>Noor — Verify your email</title></head>
<body style="margin:0;padding:0;background-color:#FAF8F3;color:#1A1040;font-family:Arial,Tahoma,sans-serif;-webkit-text-size-adjust:100%;">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;">خطوة واحدة لإكمال حسابك في نور. رمز التأكيد صالح لمدة ١٠ دقائق.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FAF8F3" style="width:100%;background-color:#FAF8F3;"><tr><td align="center" style="padding:32px 16px;">
<!--[if mso]><table role="presentation" width="560" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#FFFFFF" style="width:100%;max-width:560px;background-color:#FFFFFF;border:1px solid #E9E3D8;border-radius:20px;">
<tr><td height="4" bgcolor="#C9A86A" style="height:4px;line-height:4px;font-size:1px;border-radius:20px 20px 0 0;">&nbsp;</td></tr>
<tr><td align="center" style="padding:28px 24px 22px;border-bottom:1px solid #F0ECE4;"><img src="${base}/assets/noor-logo-v1.png" width="58" height="60" alt="نور — Noor" style="display:block;border:0;width:58px;height:60px;margin:0 auto 12px;"><div style="color:#1A1040;font-size:22px;line-height:30px;font-weight:700;" dir="ltr">Noor <span style="color:#C9A86A;">·</span> نور</div><div dir="rtl" style="font-size:13px;line-height:22px;color:#716C7D;margin-top:4px;">رفيقك اليومي</div></td></tr>
<tr><td align="center" dir="rtl" style="padding:30px 24px 10px;"><h1 style="font-size:26px;line-height:38px;font-weight:700;margin:0 0 10px;color:#1A1040;">أكّد بريدك الإلكتروني</h1><p style="font-size:16px;line-height:28px;margin:0;color:#625C70;">أدخل الرمز التالي في تطبيق نور<br>لإكمال إنشاء حسابك.</p></td></tr>
<tr><td align="center" style="padding:20px 24px 16px;"><table role="presentation" width="280" cellpadding="0" cellspacing="0" border="0" style="width:280px;max-width:100%;"><tr><td align="center" dir="ltr" bgcolor="#F8F4EC" style="padding:20px 8px;border:1px solid #E5D7BB;border-radius:14px;color:#1A1040;font-family:Arial,sans-serif;font-size:36px;font-weight:700;letter-spacing:6px;line-height:48px;white-space:nowrap;">${code}</td></tr></table></td></tr>
<tr><td align="center" dir="rtl" style="padding:0 24px 26px;"><p style="margin:0 0 8px;font-size:14px;line-height:24px;color:#625C70;">صالح لمدة <strong style="color:#1A1040;">١٠ دقائق</strong></p><p style="margin:0;font-size:13px;line-height:24px;color:#716C7D;">لا تشارك الرمز مع أي شخص.<br>لم تطلب إنشاء حساب؟ يمكنك تجاهل الرسالة.</p></td></tr>
<tr><td align="center" dir="ltr" lang="en" style="padding:22px 24px 26px;border-top:1px solid #F0ECE4;"><h2 style="margin:0 0 8px;font-size:17px;line-height:26px;color:#1A1040;">Verify your email</h2><p style="margin:0;font-size:13px;line-height:22px;color:#716C7D;">Enter the code in Noor to complete registration.<br>Valid for 10 minutes. Never share it.<br>If you did not request this, ignore this email.</p></td></tr>
</table>
<!--[if mso]></td></tr></table><![endif]-->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;"><tr><td align="center" style="padding:20px 12px 0;font-size:12px;line-height:22px;color:#817B8B;"><span dir="ltr">Noor · نور</span><br><a href="${base}/privacy" style="color:#625C70;text-decoration:underline;">الخصوصية / Privacy</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${base}/terms" style="color:#625C70;text-decoration:underline;">الشروط / Terms</a></td></tr></table>
</td></tr></table></body></html>`;
 return {to,subject:'تأكيد بريدك الإلكتروني | Noor',text,html};
}
