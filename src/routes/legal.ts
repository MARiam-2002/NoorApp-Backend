import { Router, type Request } from 'express';
import { env } from '../config';
import { NOOR_LOGO_DATA_URL } from '../shared/data/noor-brand';

export const legalRouter = Router();

const EFFECTIVE_DATE = 'September 27, 2026';
const LAST_UPDATED = 'October 10, 2026';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function field(value: string, placeholder: string): string {
  const v = value.trim();
  return v ? escapeHtml(v) : `[${placeholder}]`;
}

function publicOrigin(req: Request): string {
  const configured = (env.PUBLIC_APP_ORIGIN || '').trim().replace(/\/$/, '');
  if (configured) return configured;
  return `${req.protocol}://${req.get('host')}`;
}

function legalInfo(req: Request) {
  const origin = publicOrigin(req);
  const email = env.LEGAL_CONTACT_EMAIL.trim();
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  let websiteUrl = 'https://noor-daily-companion.kimberlysmithv894339.chatgpt.site/';
  try {
    const configured = new URL(env.LEGAL_WEBSITE);
    if (configured.protocol === 'https:' || configured.protocol === 'http:') websiteUrl = configured.href;
  } catch { /* Use the official Noor website until a custom URL is configured. */ }
  return {
    developer: field(env.LEGAL_DEVELOPER_NAME, 'LEGAL COMPANY OR DEVELOPER NAME'),
    country: field(env.LEGAL_COUNTRY, 'COUNTRY'),
    website: `<a href="${escapeHtml(websiteUrl)}">Noor official website</a>`,
    email: emailValid ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>` : field('', 'PRIVACY EMAIL'),
    emailRaw: emailValid ? email : '',
    privacyUrl: `${origin}/privacy`,
    deleteUrl: `${origin}/delete-account`,
  };
}

const STYLES = `
:root{--navy:#1a1040;--gold:#c9a86a;--cream:#faf8f3;--text:#2a2440;--muted:#6b6580;--line:#e8e3d9;--danger:#b42318}
*{box-sizing:border-box}html{scroll-behavior:smooth;scroll-padding-top:90px}body{margin:0;background:var(--cream);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;line-height:1.85;font-size:16px}a{color:#695022;text-underline-offset:4px}a:hover{color:#1a1040}a:focus-visible,button:focus-visible,input:focus-visible,summary:focus-visible{outline:3px solid #987334;outline-offset:4px}.skip{position:absolute;top:-100px;left:20px;background:white;padding:10px;z-index:10}.skip:focus{top:10px}
.topbar{background:#fff;border-bottom:1px solid var(--line)}.topbar .wrap{max-width:1200px;margin:auto;padding:18px 28px;display:flex;align-items:center;justify-content:space-between;gap:20px}.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--navy);font-size:22px;font-weight:750}.brand-logo{display:block;width:52px;height:64px;object-fit:contain}.brand-name{letter-spacing:.01em}.brand-caption{display:block;font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:500;color:var(--muted)}.topbar nav{display:flex;gap:24px;flex-wrap:wrap}.topbar nav a{font-size:14px;color:var(--muted);text-decoration:none}.topbar nav a[aria-current=page]{color:var(--navy);font-weight:700;border-bottom:2px solid var(--gold)}
header{background:var(--navy);color:#fff;position:relative;overflow:hidden}header:after{content:"";position:absolute;width:440px;height:440px;right:-170px;top:-210px;border:1px solid #ffffff16;border-radius:50%;box-shadow:0 0 0 65px #ffffff04,0 0 0 130px #ffffff03;pointer-events:none}header .wrap{max-width:1200px;margin:auto;padding:60px 28px 64px;position:relative;z-index:1}.eyebrow{color:#e7c98f;letter-spacing:.17em;text-transform:uppercase;font-size:11px;font-weight:700}h1{font-size:clamp(32px,5vw,54px);line-height:1.18;letter-spacing:-.035em;margin:18px 0}header p{color:#d1d6e1;max-width:680px;margin:0;font-size:15px}.hero-note{margin-top:22px!important;font-size:14px!important;color:#b7bfce!important}
.layout{max-width:1200px;margin:0 auto;padding:40px 28px 80px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:40px;align-items:start}.contents{position:sticky;top:24px;background:#fff;border:1px solid var(--line);border-radius:16px;padding:20px;max-height:calc(100vh - 48px);overflow:auto}.contents summary{font-size:12px;font-weight:750;text-transform:uppercase;letter-spacing:.09em;cursor:pointer;color:var(--navy)}.contents nav{display:grid;gap:3px;margin-top:14px}.contents a{display:block;text-decoration:none;font-size:13px;color:var(--muted);padding:7px 8px;border-radius:6px;line-height:1.5}.contents a:hover{background:#f5f3ee;color:var(--navy)}main{min-width:0}section{background:#fff;border:1px solid var(--line);border-radius:16px;padding:28px 32px;margin-bottom:18px;scroll-margin-top:24px}h2{color:var(--navy);font-size:21px;line-height:1.5;margin:0 0 16px;letter-spacing:-.02em}h3{color:var(--navy);font-size:16px;margin:24px 0 8px}p{margin:0 0 14px}section>:last-child{margin-bottom:0}ul,ol{padding-inline-start:24px;margin:8px 0 16px}li{padding-inline-start:4px;margin:5px 0}.note{font-size:14px;color:var(--muted)}table{width:100%;border-collapse:collapse;font-size:14px;overflow-wrap:anywhere}th,td{padding:12px;border-bottom:1px solid var(--line);text-align:start;vertical-align:top}th{background:#f7f8fa;color:var(--navy);font-weight:650}tr:last-child td,tr:last-child th{border-bottom:0}label{display:block;font-weight:600;margin:12px 0 4px}input[type=email],input[type=password]{width:100%;padding:12px 14px;border:1px solid #c8ced8;border-radius:10px;font-size:16px;background:#fff}.check{display:flex;gap:8px;align-items:flex-start;font-weight:400;margin-top:14px}button{margin-top:16px;width:100%;padding:13px 16px;border:0;border-radius:10px;background:var(--danger);color:#fff;font-size:16px;font-weight:700;cursor:pointer}button:disabled{opacity:.6;cursor:not-allowed}.msg{margin-top:14px;padding:12px 14px;border-radius:10px;font-size:15px;display:none}.msg.err{display:block;background:#fef3f2;color:var(--danger);border:1px solid #fecdca}.msg.ok{display:block;background:#ecfdf3;color:#067647;border:1px solid #abefc6}.ar{direction:rtl;text-align:right}footer{border-top:1px solid var(--line);background:#fff}.footer-wrap{max-width:1200px;margin:auto;padding:28px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;color:var(--muted);font-size:13px}.footer-links{display:flex;gap:18px;flex-wrap:wrap}
@media(max-width:850px){.layout{grid-template-columns:1fr;gap:20px;padding:24px 20px 48px}.contents{position:static;max-height:none}.contents nav{grid-template-columns:repeat(2,minmax(0,1fr))}header .wrap{padding:40px 20px}.topbar .wrap{padding:16px 20px}.topbar nav{gap:14px}section{padding:24px}table{font-size:13px}th,td{padding:9px}}
@media(max-width:480px){.topbar .wrap{align-items:flex-start;flex-direction:column;gap:12px}.topbar nav{font-size:12px;gap:18px}section{padding:20px}.contents nav{grid-template-columns:1fr}h2{font-size:19px}body{font-size:15px}.footer-wrap{padding:24px 20px}}
@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
@media print{body{background:#fff;color:#000;font-size:11pt}.topbar,.contents,.skip{display:none}.layout{display:block;padding:0}header{background:#fff;color:#000}header .wrap{padding:0 0 24px}header p,.hero-note,.eyebrow{color:#444!important}header:after{display:none}h1{font-size:28pt}section{border:0;border-radius:0;padding:12px 0;margin:0}h2,h3{break-after:avoid}tr{break-inside:avoid}footer{margin-top:24px}a{color:#000}}
`;

function page(opts: { title: string; subtitle: string; lang: string; dir: string; body: string }) {
  const sections: Array<{ id: string; title: string }> = [];
  const body = opts.body.replace(/<section([^>]*)>(\s*)<h2>([\s\S]*?)<\/h2>/g, (_match, attrs: string, space: string, heading: string) => {
    const id = `section-${sections.length + 1}`;
    sections.push({ id, title: heading.replace(/<[^>]*>/g, '') });
    return `<section${attrs} id="${id}">${space}<h2>${heading}</h2>`;
  });
  const current = opts.title === 'Privacy Policy' ? '/privacy' : opts.title === 'Terms of Use' ? '/terms' : '/delete-account';
  const links = [['/privacy', 'Privacy Policy'], ['/terms', 'Terms of Use'], ['/delete-account', 'Delete Account']]
    .map(([url, label]) => `<a href="${url}"${url === current ? ' aria-current="page"' : ''}>${label}</a>`).join('');
  return `<!doctype html>
<html lang="${opts.lang}" dir="${opts.dir}">
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="robots" content="index,follow" /><meta name="theme-color" content="#1a1040" /><link rel="icon" type="image/png" href="${NOOR_LOGO_DATA_URL}" />
<meta name="description" content="${escapeHtml(`Noor ${opts.title}. Read about your rights, responsibilities, and account choices.`)}" />
<title>${escapeHtml(opts.title)} | Noor</title><style>${STYLES}</style></head>
<body><a class="skip" href="#main-content">Skip to content</a>
<div class="topbar"><div class="wrap"><a class="brand" href="https://noor-daily-companion.kimberlysmithv894339.chatgpt.site/" aria-label="Noor home"><img class="brand-logo" src="${NOOR_LOGO_DATA_URL}" width="52" height="64" alt="Noor — نور" /><span class="brand-name">Noor / نور<span class="brand-caption">Your daily companion</span></span></a><nav aria-label="Legal pages">${links}</nav></div></div>
<header><div class="wrap"><div class="eyebrow">Noor · Legal &amp; Trust</div><h1>${escapeHtml(opts.title)}</h1><p>${escapeHtml(opts.subtitle)}</p><p class="hero-note">Clear information. Thoughtful choices. Your daily journey with Noor.</p></div></header>
<div class="layout"><aside class="contents"><details open><summary>On this page</summary><nav aria-label="Table of contents">${sections.map(s => `<a href="#${s.id}">${s.title}</a>`).join('')}</nav></details></aside><main id="main-content" tabindex="-1">${body}</main></div>
<footer><div class="footer-wrap"><span>© ${new Date().getFullYear()} Noor. All rights reserved.</span><div class="footer-links">${links}<a href="#main-content">Back to top ↑</a></div></div></footer>
</body></html>`;
}

legalRouter.get('/privacy', (req, res) => {
  const i = legalInfo(req);
  const body = `
<section>
<p>Noor ("Noor", "we", "us", or "our") respects your privacy and is committed to protecting the information you provide when using the Noor mobile application (the "App").</p>
<p>This Privacy Policy explains what information Noor collects, how we use it, how it may be processed or shared with service providers, how we protect it, and the choices available to you. This policy describes our data practices; it does not replace permission requests or consent where these are required.</p>
<p class="note">Your controls: <a href="#section-17">Your choices and rights</a> · <a href="/terms">Terms of Use</a></p><p class="note">Account deletion: <a href="/delete-account">${i.deleteUrl}</a></p>
</section>

<section>
<h2>1. About Noor</h2>
<table>
<tr><th>App name</th><td>Noor / نور</td></tr>
<tr><th>Developer / Company</th><td>${i.developer}</td></tr>
<tr><th>Country</th><td>${i.country}</td></tr>
<tr><th>Privacy contact</th><td>${i.email}</td></tr>
<tr><th>Website</th><td>${i.website}</td></tr>
<tr><th>Privacy Policy URL</th><td><a href="/privacy">${i.privacyUrl}</a></td></tr>
<tr><th>Account deletion URL</th><td><a href="/delete-account">${i.deleteUrl}</a></td></tr>
</table>
</section>

<section>
<h2>2. Information We Collect</h2>
<p>Depending on how you use Noor and which permissions you grant, we may collect the following categories of information.</p>
<h3>2.1 Account and authentication information</h3>
<ul>
<li>Name or display name</li>
<li>Username</li>
<li>Email address</li>
<li>Noor user/account ID</li>
<li>Authentication provider (email/password or Google)</li>
<li>Google account identifier when you choose Google Sign-In</li>
<li>Phone number, where you provide it</li>
<li>Profile image URL, where applicable</li>
<li>Password in protected (hashed) form — Noor never stores your password in plain text</li>
<li>Session information required to keep you signed in</li>
</ul>
<p>If you use Google Sign-In, the App sends a Google ID token to Noor's backend, which verifies it with Google and receives your email address, name, and Google account identifier.</p>
<p>You may use certain Noor features without creating an account where guest access is supported.</p>
</section>

<section>
<h2>3. Location Information</h2>
<p>Noor may request access to your device's location. When you grant permission, Noor may collect precise latitude and longitude coordinates.</p>
<p>Location information may be used to:</p>
<ul>
<li>Calculate accurate prayer times</li>
<li>Determine the Qibla direction</li>
<li>Support Azan and prayer-related features</li>
<li>Save your selected prayer location (coordinates, city, and country) to your Noor profile</li>
</ul>
<p>Location access is optional. If you deny location permission, Noor continues to work using default settings (Cairo, Egypt) or previously saved settings, although some features may be less accurate.</p>
<p>Noor does not track your location continuously in the background. Location is read only when a feature needs it, such as Qibla, refreshing prayer times, or updating your prayer location. Location coordinates may also be stored locally on your device as part of prayer and Azan settings.</p>
</section>

<section>
<h2>4. Time Zone Information</h2>
<p>Noor reads the time zone configured on your device. For signed-in users, this time zone is saved to your Noor account. We use it to calculate prayer times, align reminders with your local time, and determine your local calendar day for daily worship tracking.</p>
</section>

<section>
<h2>5. Quran and Worship Activity</h2>
<p>When you use these features while signed in, Noor stores the following information with your account:</p>
<h3>Quran</h3>
<ul>
<li>Bookmarks and notes you add to Quran content</li>
<li>Last-read position and reading history</li>
<li>Khatmah plans and progress</li>
<li>Reading preferences (font size, reciter, tafsir, translation)</li>
<li>Sajdah (prostration verse) completion</li>
</ul>
<h3>Worship and journey</h3>
<ul>
<li>Prayer completion records</li>
<li>Nawafel (sunnah prayer) completion</li>
<li>Adhkar progress and favorites</li>
<li>Tasbih counts and custom Tasbih phrases</li>
<li>Daily challenge progress, answers, points, and level</li>
<li>Sadaqah goals and amounts you enter (personal tracking only — Noor does not process payments)</li>
<li>Reminder preferences (Azan, Salawat, Surah Al-Mulk, Duha, Qiyam, Khatmah)</li>
</ul>
<p>This information is used only to provide personal progress tracking and the features you request. We do not sell your religious or worship activity data.</p>
</section>

<section>
<h2>6. Push Notifications</h2>
<p>If you grant notification permission, Noor uses Firebase Cloud Messaging (FCM) to deliver push notifications such as prayer and Azan reminders, Salawat reminders, Khatmah reminders, and other reminders you enable.</p>
<p>To deliver notifications, Noor stores an FCM device token together with your device platform, app version, and language setting. Most optional reminders are off by default until you turn them on. You can control notifications from your device settings and from Noor's notification settings.</p>
</section>

<section>
<h2>7. Device and Technical Information</h2>
<p>Noor and its service providers process technical information required to operate and secure the App, including:</p>
<ul>
<li>Device platform, app version, and locale</li>
<li>Crash and diagnostic information</li>
<li>IP address and User-Agent of requests to Noor's servers</li>
<li>Request identifiers used for troubleshooting</li>
</ul>
<p>Noor's backend uses this information for security, rate limiting (abuse prevention), diagnostics, and service operation. IP addresses are not stored in Noor's database; they may appear in server logs kept by our hosting provider.</p>
</section>

<section>
<h2>8. Analytics</h2>
<p>Noor uses Firebase Analytics to understand how the App is used. Analytics may collect screen views, app interactions, feature usage (including prayer and Khatmah activity events), and a Noor user identifier where applicable.</p>
<p>Analytics is used to understand usage, diagnose issues, and improve the App. Noor does not use analytics to sell your personal information.</p>
</section>

<section>
<h2>9. Crash Reporting</h2>
<p>Noor uses Firebase Crashlytics in release builds to identify and fix crashes. Crash reports may include crash details, technical diagnostic information, device and app information, and the Noor user identifier where configured.</p>
</section>

<section>
<h2>10. Google Sign-In</h2>
<p>If you choose to sign in with Google, Noor requests only the scopes needed for sign-in: OpenID, email, and profile. Google processes information according to its own privacy policy.</p>
</section>

<section>
<h2>11. How We Use Your Information</h2>
<ul>
<li>Create, manage, and authenticate your account</li>
<li>Provide Noor's features, including prayer times, Qibla, Quran, Khatmah, and worship tracking</li>
<li>Deliver notifications and reminders you enable</li>
<li>Send account emails such as password reset</li>
<li>Maintain security and prevent abuse and unauthorized access</li>
<li>Diagnose errors and crashes, analyze usage, and improve the App</li>
<li>Respond to support requests and comply with legal obligations</li>
</ul>
</section>

<section>
<h2>12. How We Share Information</h2>
<p>We do not sell your personal information. Information is processed by service providers that help us operate Noor:</p>
<table>
<tr><th>Provider</th><th>Purpose</th><th>Data involved</th></tr>
<tr><td>Google Firebase</td><td>Push notifications (FCM), Analytics, Crashlytics</td><td>Device token, notification content, usage and crash data</td></tr>
<tr><td>Google</td><td>Google Sign-In verification</td><td>Google ID token</td></tr>
<tr><td>Railway</td><td>Application hosting</td><td>All data processed by Noor's servers, server logs</td></tr>
<tr><td>Neon</td><td>PostgreSQL database hosting</td><td>Account and app data stored by Noor</td></tr>
<tr><td>Brevo (email delivery)</td><td>Password-reset emails</td><td>Your email address and the reset code</td></tr>
<tr><td>Quran audio hosts (EveryAyah, Quran.com CDN)</td><td>Recitation audio files downloaded directly by the App</td><td>Your device's IP address and the requested audio file (no account information)</td></tr>
<tr><td>Google Fonts</td><td>Downloading Arabic fonts used to display the Quran</td><td>Your device's IP address and the requested font (no account information)</td></tr>
</table>
<p>We do not authorize these providers to use Noor user data for purposes unrelated to the services they provide to Noor, except where required by law.</p>
</section>

<section>
<h2>13. Quran and Third-Party Content Services</h2>
<p>Some Quran text, translations, and tafsir are obtained by Noor's servers from external content services (such as Quran Foundation / Quran.com). These requests are for public content and do not include your account information.</p>
<p>When you play or download a recitation, the App downloads the audio file directly from the audio host (such as EveryAyah or the Quran.com audio CDN). That host receives your device's IP address and the requested file, but not your Noor account information.</p>
</section>

<section>
<h2>14. Data Security</h2>
<ul>
<li>Encrypted network communication (HTTPS/TLS)</li>
<li>Passwords hashed with bcrypt; session and password-reset tokens stored only as SHA-256 hashes</li>
<li>Short-lived access tokens and revocable refresh tokens</li>
<li>Secure token storage on supported devices</li>
<li>Rate limiting, security headers, and server-side validation</li>
<li>Access-controlled database</li>
</ul>
<p>No Internet service can guarantee absolute security. Please keep your credentials private.</p>
</section>

<section>
<h2>15. Data Retention</h2>
<p>We keep your information while your account is active and as needed to provide Noor's services.</p>
<p>When you delete your account, Noor permanently deletes your account and all associated app data from its database immediately, including profile, Quran and worship progress, preferences, sessions, and notification device tokens. Deleted data cannot be restored.</p>
<p>After deletion, Noor keeps only a minimal record — your email address, your Google account identifier (if you used Google Sign-In), and the deletion date — so that your deleted account is not automatically recreated or restored when an old session or sign-in is used. This record is removed if you later choose to create a new account with the same email address.</p>
<p>Server logs held by our hosting provider, and data held by Firebase (analytics and crash reports), are retained according to those providers' retention periods.</p>
<p>Some settings and cached content (for example prayer settings, the last prayer location, and downloaded Quran pages or audio) are stored only on your device. They are removed when you uninstall the App or clear its data.</p>
</section>

<section>
<h2>16. Account Deletion</h2>
<h3>In the App</h3>
<p>Open the <b>Account</b> tab in Noor and choose <b>Delete account</b>, then confirm. Deletion is immediate and permanent.</p>
<h3>Outside the App</h3>
<p>Visit <a href="/delete-account">${i.deleteUrl}</a> to delete your account on the web, or email us at ${i.email} from the email address associated with your account.</p>
<p>Some information stored locally on your device (such as cached settings) is removed when you uninstall the App or clear its data.</p>
</section>

<section>
<h2>17. Your Choices and Rights</h2>
<ul>
<li>Deny or revoke location and notification permissions</li>
<li>Update your account information and reminder preferences</li>
<li>Sign out of your account</li>
<li>Delete your Noor account</li>
<li>Contact us to request access to or correction of your personal data</li><li>Where applicable law provides these rights, request data portability, object to processing, request a restriction, or withdraw consent for processing based on consent</li>
</ul>
<p>We may need to verify your identity before fulfilling a data request. The rights and response requirements that apply depend on your location and applicable law. You may also contact the relevant data-protection authority where that right is available.</p></section><section><h2>18. Children's Privacy</h2>
<p>Noor is not intended to knowingly collect personal information from children in violation of applicable law. If you believe a child has provided personal information to Noor where this is not permitted, contact us at ${i.email} and we will take appropriate action.</p>
</section>

<section>
<h2>19. International Data Processing</h2>
<p>Noor's database is hosted in the European Union (Frankfurt, Germany). Our hosting and service providers (Railway, Google Firebase, Brevo) may process information in other countries, including the United States. Where required by law, we take appropriate measures for international transfers.</p>
</section>

<section>
<h2>20. Changes to This Privacy Policy</h2>
<p>We may update this Privacy Policy when Noor's features, data practices, or legal requirements change. When we make material changes, we will update the "Last Updated" date and, where appropriate, notify you in the App.</p>
</section>

<section>
<h2>21. Contact Us</h2>
<table>
<tr><th>Developer / Company</th><td>${i.developer}</td></tr>
<tr><th>Email</th><td>${i.email}</td></tr>
<tr><th>Website</th><td>${i.website}</td></tr>
<tr><th>Country</th><td>${i.country}</td></tr>
</table>
</section>`;

  res
    .type('html')
    .set('Cache-Control', 'public, max-age=300')
    .send(page({
      title: 'Privacy Policy',
      subtitle: `Effective: ${EFFECTIVE_DATE} · Last updated: ${LAST_UPDATED}`,
      lang: 'en',
      dir: 'ltr',
      body,
    }));
});


legalRouter.get('/terms', (req, res) => {
  const i = legalInfo(req);
  const body = `
<section><p>Welcome to Noor, your companion for Quran reading, prayer reminders, and personal worship tracking. These Terms of Use explain the conditions for using the Noor application and its related services.</p><p>Please read these terms before using Noor. By using the service, you agree to these terms to the extent permitted by applicable law. If you do not agree, please stop using the service.</p><p class="note">Read alongside our <a href="/privacy">Privacy Policy</a>. You can manage or <a href="/delete-account">delete your account</a> at any time.</p></section>
<section><h2>1. Who We Are</h2><p>Noor is operated by ${i.developer}, based in ${i.country}. For questions about these terms, contact ${i.email}.</p><table><tr><th>Application</th><td>Noor / نور</td></tr><tr><th>Operator</th><td>${i.developer}</td></tr><tr><th>Contact</th><td>${i.email}</td></tr><tr><th>Website</th><td>${i.website}</td></tr></table></section>
<section><h2>2. Eligibility and Acceptance</h2><p>You must be legally able to agree to these terms in your jurisdiction. If you are below the age at which you may do so independently, use Noor only with the permission and supervision of a parent or legal guardian as required by local law.</p><p>Additional terms may apply to features introduced later. Those terms will be presented before you use the relevant feature.</p></section>
<section><h2>3. Your Account</h2><p>Some features support guest access; others require an account. Provide accurate information, keep your credentials private, and tell us if you suspect unauthorized access. Do not impersonate others or access an account without permission.</p><p>You are responsible for activity you authorize through your account. Keep your device and contact details secure, and use the available sign-out and password-reset tools when needed.</p></section>
<section><h2>4. Permitted Use</h2><p>You may use Noor for lawful personal purposes, subject to these terms and any applicable content licenses.</p><ul><li>Do not attack, disrupt, overload, or bypass the security of our services.</li><li>Do not use automated requests to abuse the API, harvest personal data, or evade usage limits.</li><li>Do not upload unlawful content, malware, or content that infringes another person's rights.</li><li>Do not misrepresent Noor's content or branding as your own.</li></ul><p>Nothing here restricts rights that applicable law expressly permits, including lawful security research conducted without unauthorized access to personal information or disruption of the service.</p></section>
<section><h2>5. Prayer Times and Reminders</h2><p>Prayer times and Qibla calculations depend on location, time zone, calculation method, and device settings. Differences may occur between calculation methods and local mosque timetables. Verify the settings for your location and consult your local prayer timetable when needed.</p><p>Azan and other reminders can be affected by notification permissions, battery optimization, connectivity, operating-system restrictions, and device availability. Delivery at an exact time cannot be guaranteed. Noor should not be your only means of keeping track of prayer times.</p></section>
<section><h2>6. Religious Content and Discovery Features</h2><p>Quran text, translations, tafsir, hadith, and educational material are provided to support reading and learning. Translations and commentary may differ by source. Consult the cited source and a qualified scholar for religious rulings or questions requiring individual guidance.</p><p>Search and discovery results may be incomplete or contain matching errors. Check verse references and source attribution before relying on or sharing a result. Any automated assistance made available is informational and does not replace qualified religious advice.</p></section>
<section><h2>7. Your Data and Personal Entries</h2><p>Our <a href="/privacy">Privacy Policy</a> explains how account information, location settings, worship activity, and technical data are handled.</p><p>You retain your rights in personal entries you submit, such as notes and custom phrases. You permit Noor to store and process those entries only as needed to provide and maintain the requested service, subject to the Privacy Policy.</p><p>Progress scores and completion records are personal tracking tools. Sadaqah goals and amounts are entries for your own tracking; Noor does not process donations or payments through those tracking features.</p></section>
<section><h2>8. Content and Intellectual Property</h2><p>Noor's software, visual design, and brand assets are protected by applicable intellectual-property laws. These terms give you permission to use the service; they do not transfer ownership of those assets.</p><p>Third-party Quran editions, translations, commentary, recordings, and other materials remain subject to their respective rights and licenses. Respect any attribution and reuse conditions provided with the content.</p></section>
<section><h2>9. Third-Party Services</h2><p>Features may rely on third parties, including Google Sign-In, Firebase notifications, hosting, and external content sources. Their availability and applicable terms may affect those features. Links to external services do not mean Noor endorses all of their content.</p></section>
<section><h2>10. Changes and Availability</h2><p>We may maintain, update, or change features to improve the service, address security issues, or comply with applicable requirements. Temporary interruptions may occur. Where reasonably practicable, we will give notice of material changes that affect your use.</p><p>If a paid feature is introduced, its price and applicable purchase or cancellation conditions will be disclosed separately before purchase.</p></section>
<section><h2>11. Suspension and Account Deletion</h2><p>We may restrict access where reasonably necessary to address serious misuse, a security risk, or a legal requirement. Where practicable and lawful, we will explain the restriction and allow you to contact us about it.</p><p>You may stop using Noor or <a href="/delete-account">delete your account</a> at any time. Deletion is permanent. The Privacy Policy explains what is deleted, the minimal deletion record retained, and how provider logs and local device data are handled.</p></section>
<section><h2>12. Service Limits and Responsibility</h2><p>We work to provide a reliable service, but cannot promise uninterrupted availability, error-free content, or exact reminder delivery. To the extent permitted by law, the service is provided as available.</p><p>Nothing in these terms excludes liability that cannot lawfully be excluded, or limits mandatory consumer rights. Any responsibility for loss is determined under applicable law, taking account of the circumstances.</p></section>
<section><h2>13. Applicable Law and Resolving Concerns</h2><p>These terms operate subject to applicable law, including any mandatory protections in your country of residence. They do not require you to waive those protections or agree to compulsory arbitration.</p><p>If you have a concern, contact ${i.email} so we can try to resolve it. This does not prevent you from using any court, regulator, or complaint process available under applicable law.</p></section>
<section><h2>14. Updates to These Terms</h2><p>We may update these terms as features or requirements change. We will update the date shown on this page and provide additional notice of material changes where appropriate. Where new agreement is legally required, we will request it.</p></section>
<section><h2>15. Contact Us</h2><p>For questions about using Noor or these terms, contact ${i.email}. For information about your personal data, see the <a href="/privacy">Privacy Policy</a>.</p></section>`;
  res.type('html').set('Cache-Control', 'public, max-age=300').send(page({
    title: 'Terms of Use', subtitle: `Effective: October 10, 2026 · Last updated: ${LAST_UPDATED}`,
    lang: 'en', dir: 'ltr', body,
  }));
});
legalRouter.get('/delete-account', (req, res) => {
  const i = legalInfo(req);
  const mailto = i.emailRaw
    ? `<a href="mailto:${escapeHtml(i.emailRaw)}?subject=${encodeURIComponent('Noor account deletion request')}">${escapeHtml(i.emailRaw)}</a>`
    : i.email;

  const body = `
<section class="ar" dir="rtl">
<h2>حذف حساب نور</h2>
<p>تقدر تحذف حسابك وكل بياناتك في أي وقت. الحذف <b>فوري ونهائي</b> ومايمكنش استرجاعه.</p>
<h3>إيه اللي بيتمسح</h3>
<ul>
<li>بيانات الحساب: الاسم، الإيميل، الباسورد، ربط جوجل</li>
<li>تقدم القرآن: العلامات، آخر قراءة، سجل القراءة، الختمة</li>
<li>تقدم العبادات: الصلوات، النوافل، الأذكار، التسبيح، التحديات، النقاط، الصدقة</li>
<li>الإعدادات والتذكيرات، وتوكنات الإشعارات، وجلسات الدخول</li>
</ul>
<h3>إيه اللي بيفضل</h3>
<p>سجل صغير فيه الإيميل ومعرّف جوجل وتاريخ الحذف، عشان الحساب المحذوف مايترجعش تلقائياً. السجل ده بيتشال لو عملت حساب جديد بنفس الإيميل.</p>
<p>بيانات الاستخدام وتقارير الأعطال في Firebase بتتشال حسب مدة الاحتفاظ عندهم. وبعض الإعدادات والمحتوى المحفوظ على الموبايل نفسه بيتشال لما تمسح التطبيق أو تمسح بياناته.</p>
<h3>طرق الحذف</h3>
<ol>
<li><b>من التطبيق:</b> تبويب الحساب ← حذف الحساب ← تأكيد.</li>
<li><b>من هنا:</b> لو بتدخل بالإيميل والباسورد، استخدم الفورم تحت.</li>
<li><b>لو بتدخل بجوجل:</b> احذف من التطبيق، أو ابعت طلب من نفس الإيميل على ${mailto}.</li>
</ol>
</section>

<section>
<h2>Delete your Noor account</h2>
<p>You can delete your account and all associated data at any time. Deletion is <b>immediate and permanent</b>.</p>
<h3>What is deleted</h3>
<ul>
<li>Account data: name, email, password, Google link</li>
<li>Quran progress: bookmarks, last read, reading history, Khatmah</li>
<li>Worship progress: prayers, nawafel, adhkar, tasbih, challenges, points, sadaqah</li>
<li>Settings and reminders, notification device tokens, and sessions</li>
</ul>
<h3>What is kept</h3>
<p>A minimal record (email, Google account identifier, deletion date) so the deleted account is not automatically restored. It is removed if you later create a new account with the same email.</p>
<p>Usage analytics and crash reports held by Firebase are removed according to Firebase's retention periods. Settings and cached content stored only on your device are removed when you uninstall the App or clear its data.</p>
<h3>How to delete</h3>
<ol>
<li><b>In the App:</b> Account tab → Delete account → Confirm.</li>
<li><b>On this page:</b> if you sign in with email and password, use the form below.</li>
<li><b>Google Sign-In accounts:</b> delete from the App, or email ${mailto} from your account's email address.</li>
</ol>
</section>

<section>
<h2>Delete with email and password · الحذف بالإيميل والباسورد</h2>
<p class="note">This form submits your credentials directly to Noor over the same secure connection. Your password is not saved by this page.</p><form id="del" autocomplete="on" novalidate>
<label for="email">Email · الإيميل</label>
<input id="email" name="email" type="email" required autocomplete="email" />
<label for="password">Password · الباسورد</label>
<input id="password" name="password" type="password" required autocomplete="current-password" />
<label class="check"><input id="confirm" type="checkbox" required /> <span>I understand this permanently deletes my account and data. · أفهم إن الحذف نهائي.</span></label>
<button id="btn" type="submit">Delete my account · احذف حسابي</button>
<div id="msg" class="msg" role="status" aria-live="polite"></div>
</form>
</section>

<script>
(function () {
  var form = document.getElementById('del');
  var btn = document.getElementById('btn');
  var msg = document.getElementById('msg');
  function show(kind, text) { msg.className = 'msg ' + kind; msg.textContent = text; }
  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    var email = document.getElementById('email').value.trim();
    var password = document.getElementById('password').value;
    if (!document.getElementById('email').checkValidity() || !password) { show('err', 'Enter your email and password. · اكتب الإيميل والباسورد.'); return; }
    if (!document.getElementById('confirm').checked) { show('err', 'Please confirm deletion. · أكّد الحذف.'); return; }
    btn.disabled = true;
    try {
      var login = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email, password: password })
      });
      if (login.status === 429) { show('err', 'Too many attempts. Try again later. · محاولات كتير، جرّب بعدين.'); return; }
      var lj = await login.json().catch(function () { return {}; });
      var token = lj && lj.data && lj.data.tokens && lj.data.tokens.accessToken;
      if (!login.ok || !token) { show('err', 'Email or password is incorrect. · الإيميل أو الباسورد غلط.'); return; }
      document.getElementById('password').value = '';
      var del = await fetch('/api/v1/auth/me', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
      if (del.status === 429) { show('err', 'Too many requests. Try again later. · محاولات كتير، جرّب بعدين.'); return; }
      if (!del.ok) { show('err', 'Deletion failed. Please try again. · الحذف فشل، جرّب تاني.'); return; }
      form.reset();
      show('ok', 'Your account and data were deleted. · تم حذف حسابك وبياناتك.');
    } catch (err) {
      show('err', 'Network error. Please try again. · مشكلة في الاتصال، جرّب تاني.');
    } finally {
      btn.disabled = false;
    }
  });
})();
</script>`;

  res
    .type('html')
    .set('Cache-Control', 'no-store')
    .send(page({
      title: 'Delete Account · حذف الحساب',
      subtitle: 'Noor account and data deletion',
      lang: 'en',
      dir: 'ltr',
      body,
    }));
});
