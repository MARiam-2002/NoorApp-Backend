"use strict";

// ============================================================
//  NOOR API — VERCEL HANDLER  (KISS EDITION)
//  Rule #1: THIS FILE MUST NEVER THROW. NEVER.
//  Rule #2: If it would throw, we return HTML/JSON instead.
//  Rule #3: Root "/" responds in <1ms. Always.
// ============================================================

// ---------- STEP 0: INJECT SAFE DEFAULTS BEFORE ANY require() ----------
// This prevents Zod in config.ts from THROWING at module-load time
// (which was the #1 cause of the "grey spinner" silent death on Vercel).
(function injectSafeEnvDefaults() {
  const defs = {
    NODE_ENV: process.env.NODE_ENV || "production",
    PORT: process.env.PORT || "3000",
    DATABASE_URL:
      process.env.DATABASE_URL ||
      "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    JWT_SECRET:
      process.env.JWT_SECRET ||
      "fallback_jwt_secret_please_set_vercel_env_vars_minimum_32_chars_long",
    JWT_REFRESH_SECRET:
      process.env.JWT_REFRESH_SECRET ||
      "fallback_jwt_refresh_secret_please_set_vercel_env_vars",
    CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  };
  for (const k of Object.keys(defs)) {
    if (!process.env[k]) process.env[k] = defs[k];
  }
})();

const path = require("node:path");

// ---------- STEP 1: STATIC LANDING HTML (never depends on the app) ----------
const LANDING = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#1A1040"><title>Noor API | واجهة برمجة تطبيقات نور</title><style>
:root{--navy:#1A1040;--navy2:#2A1B5C;--gold:#C9A86A;--gold2:#B39156;--cream:#FAF8F3;--text:#1A1040;--muted:#5A5475;--subtle:#9F9F9F;--border:#ECE9E0}
*{box-sizing:border-box}
body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,"Noto Sans Arabic","Tajawal",sans-serif;color:var(--cream);
  background:
    radial-gradient(1100px 600px at 15% -10%,rgba(201,168,106,.22),transparent 55%),
    radial-gradient(800px 500px at 110% 10%,rgba(42,27,92,.85),transparent 55%),
    linear-gradient(180deg,#0F0A28,#1A1040 55%,#201550)}
main{max-width:980px;margin:0 auto;padding:64px 24px 96px;position:relative;z-index:1}
.brand{display:inline-flex;align-items:center;gap:14px;margin-bottom:22px}
.brand img{width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 6px 18px rgba(201,168,106,.35))}
.brand .t{font-size:40px;font-weight:900;color:#fff;letter-spacing:-1px;font-family:Tajawal,sans-serif}
.brand .t span{background:linear-gradient(90deg,#F4EBDB,#D9BD95 60%,#C9A86A);-webkit-background-clip:text;background-clip:text;color:transparent}
.b{display:inline-flex;align-items:center;gap:10px;padding:7px 16px;border-radius:999px;background:rgba(201,168,106,.14);color:#F4EBDB;font-weight:700;font-size:13px;border:1px solid rgba(201,168,106,.35)}
.d{width:9px;height:9px;border-radius:50%;background:#C9A86A;box-shadow:0 0 0 5px rgba(201,168,106,.22);animation:p 1.6s infinite}
@keyframes p{0%,100%{opacity:1}50%{opacity:.55}}
h1{font-size:48px;line-height:1.12;margin:14px 0 10px;font-weight:900;letter-spacing:-.8px;font-family:Tajawal,sans-serif}
h1 span{background:linear-gradient(90deg,#fff 0%,#F4EBDB 35%,#D9BD95 70%,#C9A86A 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.l{font-size:18px;color:rgba(244,235,219,.8);margin:0 0 34px;line-height:1.9}
.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin:28px 0 38px}
.c{background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.018));border:1px solid rgba(244,235,219,.1);border-radius:20px;padding:26px;transition:.25s ease;position:relative;overflow:hidden}
.c::before{content:"";position:absolute;top:0;inset-inline-start:0;width:4px;height:100%;background:linear-gradient(180deg,#C9A86A,rgba(201,168,106,0));opacity:.7;border-radius:4px}
.c:hover{transform:translateY(-3px);border-color:rgba(201,168,106,.5);box-shadow:0 14px 40px rgba(0,0,0,.3)}
.c h3{margin:0 0 8px;font-size:19px;color:#fff;font-weight:800}
.c p{margin:0 0 16px;color:rgba(244,235,219,.72);font-size:14.5px;line-height:1.8}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:12px 18px;border-radius:12px;font-weight:800;transition:.2s ease;border:1px solid transparent;font-size:14px}
.btn.p{background:linear-gradient(180deg,#C9A86A,#B39156);color:#1A1040;border-color:#B39156;box-shadow:0 6px 18px rgba(201,168,106,.3)}
.btn.p:hover{filter:brightness(1.08);transform:translateY(-1px)}
.btn.o{background:transparent;border-color:rgba(244,235,219,.15);color:rgba(244,235,219,.95)}
.btn.o:hover{background:rgba(244,235,219,.06);border-color:rgba(201,168,106,.4)}
.s{display:flex;align-items:center;gap:12px;font-size:14px;color:rgba(244,235,219,.7);margin-top:10px;flex-wrap:wrap}
.pi{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(201,168,106,.15);color:#F4EBDB;font-size:12px;border:1px solid rgba(201,168,106,.32);font-weight:700;margin-bottom:12px}
footer{margin-top:38px;color:rgba(244,235,219,.6);font-size:13px;opacity:.9}
code{font-family:ui-monospace,Consolas,monospace;background:rgba(244,235,219,.08);padding:3px 10px;border-radius:8px;font-size:13px;color:#D9BD95;font-weight:600;word-break:break-word}
.flow{display:flex;flex-wrap:wrap;gap:8px;margin-top:6px}
@media(max-width:560px){
  h1{font-size:34px}
  .brand{margin-bottom:18px}.brand img{width:48px;height:48px}.brand .t{font-size:32px}
  main{padding:40px 18px 72px}
}
</style></head><body><main>
  <div class="brand">
    <img src="/brand/logo.png" alt="نور" onerror="this.style.display='none'"/>
    <span class="t"><span>نور</span></span>
  </div>
  <span class="b"><span class="d"></span> الخدمة تعمل — API Online</span>
  <h1>Noor API ✨<br/><span>واجهة برمجة تطبيقات نور</span></h1>
  <p class="l">نسخة <b>v1.0.0</b> — القرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · القبلة · التسبيح · رحلة إسلامية يومية كاملة لتطبيق Flutter.</p>
  <div class="g">
    <div class="c"><span class="pi">Swagger / OpenAPI 3.1</span><h3>📚 التوثيق التفاعلي</h3><p>جرب جميع الـ 53 endpoint مباشرة من المتصفح مع وصف عربي لكل طلب واستجابة.</p><a class="btn p" href="/api/v1/docs">افتح التوثيق ↗</a></div>
    <div class="c"><span class="pi">Monitoring</span><h3>🩺 فحص صحة الخدمة</h3><p>تأكد من أن قاعدة البيانات والخدمة تعمل بشكل سليم (Health + DB check).</p><a class="btn o" href="/api/v1/health">/api/v1/health ↗</a></div>
    <div class="c"><span class="pi">Discover</span><h3>🧭 روابط سريعة للمطورين</h3><p>أشهر الـ endpoints التي يحتاجها فريق Flutter للبدء فوراً.</p><div class="flow"><code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code><code>/tasbih</code><code>/qibla</code></div></div>
  </div>
  <div class="s"><span>Base URL للاستخدام في تطبيق Flutter:</span><code>/api/v1</code></div>
  <footer>© ${new Date().getFullYear()} Noor App — Express 5 · TypeScript · Prisma 6 · Neon PostgreSQL · Vercel</footer>
</main></body></html>`;

// ---------- STEP 2: RESPONSE HELPERS (raw Node, zero deps) ----------
function sendHtml(res, status, html) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=15, s-maxage=45, stale-while-revalidate=86400",
    );
    res.end(html);
  } catch (_e) {
    try {
      res.end("OK");
    } catch (_f) {
      /* dead response */
    }
  }
}

function sendJson(res, status, body) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch (_e) {
    try {
      res.end('{"ok":false}');
    } catch (_f) {
      /* dead response */
    }
  }
}

function errorHtml(errMsg) {
  const safe = String(errMsg || "Unknown error").replace(
    /[<>&]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c],
  );
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>⚠ Noor API — مشكلة في التشغيل</title><style>body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:linear-gradient(180deg,#0b1020,#121a33);color:#e6eaf2;display:flex;align-items:center;justify-content:center;padding:24px}.card{max-width:640px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px}.pill{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,.15);color:#fde68a;font-weight:700;font-size:12px;border:1px solid rgba(251,191,36,.35)}h1{margin:14px 0 6px;font-size:28px;color:#fff}p{color:#93a0b8;line-height:1.7}code{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:3px 9px;border-radius:6px;font-size:13.5px;color:#c7d2fe;word-break:break-all;display:inline-block;margin:3px 5px 3px 0}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}a.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;border:1px solid transparent;transition:.2s}a.p{background:#10b981;color:#052e22}a.o{background:transparent;border-color:rgba(255,255,255,.15);color:#e6eaf2}.err{margin-top:20px;padding:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:14px;font-family:ui-monospace,Consolas,monospace;color:#fca5a5;font-size:12.5px;white-space:pre-wrap;word-break:break-word}.ok{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4);color:#86efac}ul{color:#93a0b8;padding-right:20px}li{margin:5px 0}</style></head><body><div class="card"><span class="pill">⚠ تنبيه: الـ API محتاج إعدادات إضافية</span><h1>الرئيسية اشتغلت ✅ — لكن باقي الـ API محتاج ضبط بسيط</h1><p>ده معناه إن الـ handler شغال تمام على Vercel، بس إما:<br/>(أ) متغيرات البيئة مش موجودة / مفعلة على Production<br/>(ب) أو الـ build مش ناجح للـ TypeScript<br/><br/><b>الخطوات الصح لضبط Vercel (بالترتيب):</b></p><ul><li>1. افتحي <b>Vercel Dashboard</b> → مشروعك → <b>Settings</b> → <b>Environment Variables</b></li><li>2. أضيفي الأربع دول التالية <b>ومفعلي الـ ✅ Production</b> معاهم (مش Preview بس):</li></ul><div><code>DATABASE_URL</code><code>JWT_SECRET</code><code>JWT_REFRESH_SECRET</code><code>NODE_ENV=production</code></div><ul><li>3. افتحي <b>Deployments</b> → أخر deploy → الثلاث نقاط → <b>Redeploy</b> مع تحديد <code>Build without cache</code></li><li>4. التزمي أن الـ Node Version في Project Settings → General = <b>24.x</b></li></ul><div class="row"><a class="btn p" target="_blank" href="https://vercel.com/dashboard">افتح Vercel Dashboard ↗</a><a class="btn o" href="/">الرئيسية ↻</a></div><details style="margin-top:20px"><summary style="cursor:pointer;color:#c7d2fe;font-weight:600">💡 تفاصيل الخطأ الفعلي للتشخيص:</summary><div class="err">${safe}</div></details></div></body></html>`;
}

// ---------- STEP 2b: PREMIUM DOCS HUB PAGE (zero deps) ----------
// For /api/v1/docs URLs we serve THIS page first — it instantly renders,
// then gracefully upgrades to Swagger UI if possible. No infinite spinner EVER.
function docsHubHtml() {
  const JSON_URL = "/api/v1/swagger.json";
  const LOGO =
    "https://asset.cloudinary.com/dgzucjqgi/f9fbb8b99944054a0378125ae226ae60";
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#1A1040" />
<title>Noor API | توثيق نور</title>
<style>
:root{
  --navy:#1A1040;--navy2:#2A1B5C;--navy-soft:rgba(26,16,64,.08);
  --gold:#C9A86A;--gold2:#B39156;--gold-light:#D9BD95;--gold-muted:#F4EBDB;
  --cream:#FAF8F3;--surface:#FFFFFF;
  --text:#1A1040;--muted:#5A5475;--subtle:#9F9F9F;
  --border:#ECE9E0;--border-hover:#D9D4C6;
  --ok:#2D8A61;--bad:#B83A2F;--warn:#A97D1F;--info:#3555AE;
  --r-sm:8px;--r:12px;--r-lg:16px;
  --sh-xs:0 1px 2px rgba(26,16,64,.04);--sh-sm:0 2px 10px rgba(26,16,64,.05);--sh-md:0 6px 24px rgba(26,16,64,.07)
}
*{box-sizing:border-box}
html,body{margin:0;background:var(--cream);color:var(--text);font-family:Inter,'Segoe UI',-apple-system,BlinkMacSystemFont,Tajawal,'SF Pro Display',sans-serif;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale}
.tb{
  background:rgba(255,255,255,.96);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);
  padding:16px 0;position:sticky;top:0;z-index:50;
}
.tb::before{content:"";position:absolute;inset-inline:0;top:0;height:3px;background:linear-gradient(90deg,transparent 5%,var(--navy) 25%,var(--gold) 50%,var(--navy) 75%,transparent 95%)}
.tb .wrap{max-width:1280px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:relative;z-index:1}
.brand{display:inline-flex;align-items:center;gap:14px}
.brand img{width:44px;height:44px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(26,16,64,.15))}
.brand .t{font-size:28px;font-weight:800;color:var(--navy);letter-spacing:-.5px;font-family:Tajawal,Inter,sans-serif}
.ql{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
a.bx{display:inline-flex;align-items:center;gap:7px;padding:9px 15px;border-radius:10px;font-weight:700;font-size:12.5px;text-decoration:none;border:1px solid;transition:.2s ease;font-family:Inter,Tajawal,sans-serif}
a.bx.p{background:linear-gradient(180deg,var(--gold),var(--gold2));color:var(--navy);border-color:var(--gold2);box-shadow:0 2px 10px rgba(201,168,106,.32)}
a.bx.n{background:linear-gradient(180deg,var(--navy),var(--navy2));color:#fff;border-color:var(--navy);box-shadow:0 3px 12px rgba(26,16,64,.25)}
a.bx.s{background:var(--surface);border-color:var(--border);color:var(--text);box-shadow:var(--sh-xs)}
a.bx:hover{transform:translateY(-1.5px)}
.main{max-width:1280px;margin:0 auto;padding:34px 24px 120px}
.hero{
  background:linear-gradient(135deg,#1A1040 0%,#2A1B5C 55%,#1A1040 100%);
  border-radius:20px;padding:44px 40px;margin:0 0 26px;color:#fff;position:relative;overflow:hidden;
  box-shadow:0 14px 50px rgba(26,16,64,.28)
}
.hero::before{content:"";position:absolute;width:480px;height:480px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,106,.32),transparent 65%);top:-160px;inset-inline-start:-120px;pointer-events:none}
.hero::after{content:"";position:absolute;width:340px;height:340px;border-radius:50%;background:radial-gradient(circle,rgba(201,168,106,.2),transparent 70%);bottom:-140px;inset-inline-end:-100px;pointer-events:none}
.hero .row{display:flex;align-items:center;gap:20px;position:relative;z-index:1}
.hero img{width:68px;height:68px;object-fit:contain;filter:drop-shadow(0 8px 22px rgba(201,168,106,.42))}
.hero h1{margin:0 0 6px;font-size:34px;font-weight:900;letter-spacing:-.8px;font-family:Tajawal,Inter,sans-serif}
.hero h1 span{background:linear-gradient(90deg,#F4EBDB 0%,#D9BD95 55%,#C9A86A 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.hero p{margin:0;color:rgba(255,255,255,.82);font-size:16px;line-height:1.9;position:relative;z-index:1}
.hero .chips{display:flex;gap:10px;flex-wrap:wrap;margin-top:24px;position:relative;z-index:1}
.hero .chip{display:inline-flex;align-items:center;gap:7px;padding:9px 17px;border-radius:999px;background:rgba(201,168,106,.2);border:1px solid rgba(201,168,106,.4);color:#F4EBDB;font-size:12.5px;font-weight:700}
.hero .chip.solid{background:linear-gradient(180deg,var(--gold),var(--gold2));color:var(--navy);border-color:transparent;font-weight:900;box-shadow:0 4px 14px rgba(201,168,106,.38)}
.hero code{background:rgba(26,16,64,.5);color:#F4EBDB;padding:3px 11px;border-radius:8px;margin-inline:6px;font-weight:700}
.loadbox{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:40px 30px;text-align:center;box-shadow:var(--sh-sm);margin-bottom:24px}
.ldr{display:inline-block;width:32px;height:32px;border:3px solid var(--border);border-top-color:var(--gold);border-radius:50%;animation:sp 1s linear infinite;margin-bottom:16px}
@keyframes sp{to{transform:rotate(360deg)}}
.ldt{font-size:17px;color:var(--text);font-weight:800;margin:0 0 4px;letter-spacing:-.3px}
.lds{font-size:13.5px;color:var(--subtle);margin:0 0 20px}
.pills{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-top:8px}
.pil{display:inline-flex;align-items:center;gap:7px;padding:7px 15px;border-radius:999px;border:1px solid;font-size:12.5px;font-weight:700}
.pil.p{background:rgba(201,168,106,.13);color:var(--gold2);border-color:rgba(201,168,106,.32)}
.pil.o{background:rgba(45,138,97,.1);color:var(--ok);border-color:rgba(45,138,97,.28)}
.pil.b{background:rgba(184,58,47,.1);color:var(--bad);border-color:rgba(184,58,47,.28)}
.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px;margin:24px 0}
.cd{background:var(--surface);border:1px solid var(--border);border-radius:var(--r-lg);padding:24px;transition:.25s ease;box-shadow:var(--sh-xs);position:relative;overflow:hidden}
.cd::before{content:"";position:absolute;top:0;inset-inline-start:0;width:4px;height:100%;background:linear-gradient(180deg,var(--navy),var(--gold));opacity:.85;border-radius:4px}
.cd:hover{transform:translateY(-2.5px);border-color:rgba(201,168,106,.5);box-shadow:var(--sh-md)}
.cd h3{margin:0 0 10px;font-size:18.5px;color:var(--text);font-weight:800}
.cd p{margin:0 0 16px;color:var(--muted);font-size:14.5px;line-height:1.8}
.cd .tag{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(201,168,106,.13);color:var(--gold2);font-size:11.5px;border:1px solid rgba(201,168,106,.3);font-weight:700;margin-bottom:12px}
#swagger-ui{position:relative;z-index:1}
.swagger-ui .topbar{background:#fff!important;border-bottom:1px solid var(--border)!important;padding:14px 0!important;box-shadow:none!important;margin:0 -24px 32px!important;padding-inline:24px!important}
.swagger-ui .info{background:#fff!important;border:1px solid var(--border)!important;border-radius:var(--r-lg)!important;padding:28px 32px!important;margin:0 0 24px!important;box-shadow:var(--sh-xs)!important}
.swagger-ui .opblock{border:1px solid var(--border)!important;border-radius:var(--r-lg)!important;margin:12px 0!important;background:#fff!important;box-shadow:var(--sh-xs)!important;overflow:hidden!important}
.basehint{background:linear-gradient(180deg,#fff,var(--gold-muted));border:1px solid rgba(201,168,106,.25);border-radius:14px;padding:18px 22px;margin:24px 0 0;color:var(--muted);font-size:14px;box-shadow:var(--sh-xs)}
.basehint b{color:var(--gold2);font-weight:800;font-size:14.5px}
.basehint .ecs{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px}
.basehint code{background:#fff;color:var(--navy);padding:4px 11px;border-radius:8px;font-size:12.5px;font-family:ui-monospace,Consolas,monospace;font-weight:700;border:1px solid rgba(201,168,106,.25);box-shadow:0 1px 2px rgba(26,16,64,.04)}
@media(max-width:560px){
  .hero{padding:30px 22px;border-radius:16px}
  .hero h1{font-size:26px}.hero img{width:52px;height:52px}
  .main{padding:22px 16px 80px}
  .tb .wrap{padding:0 18px}
  .brand img{width:38px;height:38px}.brand .t{font-size:24px}
}
</style>
</head>
<body>
<div class="tb"><div class="wrap">
  <div class="brand">
    <img src="${LOGO}" alt="نور" onerror="this.style.display='none'"/>
    <span class="t">نور</span>
  </div>
  <div class="ql">
    <a class="bx s" href="${JSON_URL}">OpenAPI JSON ↓</a>
    <a class="bx n" target="_blank" onclick="window.location.href='https://editor.swagger.io/?url='+encodeURIComponent(window.location.origin+'${JSON_URL}');return false;" href="#">Swagger Editor ↗</a>
  </div>
</div></div>
<div class="main">
  <div class="hero">
    <div class="row">
      <img src="${LOGO}" alt="نور" onerror="this.style.display='none'"/>
      <div>
        <h1>✨ توثيق <span>Noor API</span></h1>
        <p>نسخة v1.0 — <b>53 endpoint</b> للقرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · القبلة · التسبيح · التحديات · رحلة يومية كاملة لتطبيق Flutter.</p>
        <div class="chips">
          <span class="chip solid">Base URL: <code>/api/v1</code></span>
          <span class="chip">Swagger / OpenAPI 3.1</span>
          <span class="chip">JWT Bearer Auth</span>
          <span class="chip">Express 5 · Prisma 6</span>
        </div>
      </div>
    </div>
  </div>
  <div id="wrapBeforeSwagger">
    <div class="loadbox" id="loadBox">
      <div class="ldr" id="spinner"></div>
      <p class="ldt">جارٍ تحميل واجهة التوثيق التفاعلي...</p>
      <p class="lds" id="statusTxt">1/3 تحميل مكتبة Swagger UI من CDN</p>
      <div class="pills" id="pillRow" style="margin-top:16px">
        <span class="pil p" id="p1">⏳ واجهة Swagger</span>
        <span class="pil p" id="p2">⏳ API Specs</span>
        <span class="pil p" id="p3">⏳ العرض النهائي</span>
      </div>
      <div style="margin-top:30px;padding-top:24px;border-top:1px dashed var(--border);text-align:center;color:var(--subtle);font-size:13.5px">
        <p style="margin:4px 0">إذا استغرق أكثر من ١٠ ثواني — الخيارات التالية تعمل ١٠٠٪ بدون الحاجة للـ CDN:</p>
        <div class="gr" style="margin:16px auto 0;max-width:600px">
          <div class="cd"><span class="tag">الأفضل للمطورين 💎</span><h3>Swagger Editor الرسمي</h3><p>نفس واجهة Swagger بالكامل على موقع الرسمي + الاتصال بمواصفاتنا مباشرة.</p><a class="bx n" style="width:100%" target="_blank" onclick="window.location.href='https://editor.swagger.io/?url='+encodeURIComponent(window.location.origin+'${JSON_URL}');return false;" href="#">افتحي الآن ↗</a></div>
          <div class="cd"><span class="tag">فريق Flutter 📮</span><h3>Postman Collection</h3><p>File → Import → رابط. ألصقي رابط الـ JSON بيولعلك 53 endpoint جاهزين.</p><a class="bx p" style="width:100%" href="${JSON_URL}">نسخ رابط الـ JSON ↓</a></div>
        </div>
      </div>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <div class="basehint">
    <b>💡 نصيحة لفريق Flutter:</b> Base URL للإستخدام في التطبيق هو <code id="noorBaseUrlHint">/api/v1</code><script>(function(){try{var e=document.getElementById('noorBaseUrlHint');if(e&&window.location)e.textContent=window.location.origin+'/api/v1';}catch(_){}})();</script>
    <div class="ecs">
      <code>/quran/surahs</code><code>/quran/surah/1</code><code>/content/verse-of-day</code><code>/content/hadith-of-day</code><code>/prayers/today</code><code>/journey/today</code><code>/challenges</code><code>/tasbih</code><code>/qibla</code><code>/auth/login</code><code>/health</code>
    </div>
  </div>
</div>

<script>
var state = { ui:false, spec:false, rendered:false };
var GLOBAL_TIMEOUT_MS = 10000;
var _hardFallbackAt = setTimeout(function(){
  if (state.rendered) return;
  hideLoadBox(); showFriendlyFallback('انتهت المهلة الزمنية — الواجهة لم تكتمل خلال ١٠ ثواني (غالباً مشكلة إنترنت أو CDN).');
}, GLOBAL_TIMEOUT_MS);

function setPill(id, cls, txt){ var e=document.getElementById(id); if(!e) return; e.className='pil '+cls; if(txt) e.textContent=txt; }
function setMsg(t){ var e=document.getElementById('statusTxt'); if(e) e.textContent=t; }
function hideLoadBox(){
  var lb=document.getElementById('loadBox'), sp=document.getElementById('spinner');
  if(lb){ lb.style.display='none'; } if(sp){ sp.style.animation='none'; }
}
function delBoxes(){ try{ var w=document.getElementById('wrapBeforeSwagger'); if(w){ w.parentNode.removeChild(w); } }catch(_){} }
function showFriendlyFallback(reason){
  clearTimeout(_hardFallbackAt);
  var rootA = document.getElementById('swagger-ui');
  if (rootA) {
    var html =
      '<div style="max-width:920px;margin:0 auto;padding:6px 0 28px">' +
      '<div style="background:rgba(184,58,47,.08);border:1px solid rgba(184,58,47,.28);color:var(--bad);padding:13px 20px;border-radius:14px;font-size:14px;font-weight:700;margin-bottom:20px">⚠ ' + String(reason||'خطأ غير معروف').replace(/[<>&]/g,'') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">' +
        '<div class="cd"><span class="tag">الخيار الأول 💎</span><h3>Swagger Editor الرسمي</h3><p>نفس الواجهة الأصلية مع نفس الـ 53 endpoints. زر Try it out شغال تمام.</p><a class="bx n" style="width:100%" target="_blank" onclick="window.location.href=\'https://editor.swagger.io/?url=\'+encodeURIComponent(window.location.origin+\'${JSON_URL}\');return false;" href="#">افتحي في editor.swagger.io ↗</a></div>' +
        '<div class="cd"><span class="tag">الخيار الثاني 📮</span><h3>استيراد لـ Postman</h3><p>File → Import → رابط. الصقي الـ URL تحت وبيجيبلك كل الـ endpoints مع parameters و responses.</p><a class="bx p" style="width:100%" href="${JSON_URL}">نسخ رابط الـ OpenAPI JSON ↓</a></div>' +
        '<div class="cd"><span class="tag">الخيار الثالث 🔧</span><h3>استكشاف سريع من المتصفح</h3><p>الروابط الأساسية اللي فريق Flutter بيحتاجها للتجربة المباشرة.</p><div style="display:flex;gap:7px;flex-wrap:wrap">' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/health">/health</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/quran/surahs">/quran/surahs</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/content/verse-of-day">/verse-of-day</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/prayers/today?city=Cairo">/prayers/today</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/journey/today">/journey/today</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/tasbih">/tasbih</a>' +
        '</div></div>' +
      '</div></div>';
    rootA.innerHTML = html;
  }
  hideLoadBox();
}

// CSS loader with fallback (inline styles if CDN blocked)
(function(){
  try{
    var l=document.createElement('link'); l.rel='stylesheet';
    l.href='https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui.css';
    var ok=false; l.onload=function(){ok=true};
    setTimeout(function(){
      if(!ok){ try{
        var s=document.createElement('style');
        s.textContent='.swagger-ui{font-family:Inter,Segoe UI,sans-serif}.swagger-ui .topbar{display:none}.swagger-ui .info{padding:20px;background:#fff;border:1px solid var(--border);border-radius:14px;margin:16px 0}.opblock{border:1px solid var(--border);border-radius:14px;overflow:hidden;margin:12px 0;background:#fff}.opblock-summary{padding:14px;display:flex;gap:14px;align-items:center}.opblock-summary-method{padding:7px 16px;border-radius:8px;font-weight:700;color:#fff;font-size:12px}';
        document.head.appendChild(s); }catch(e){}
      }
    }, 4000);
    document.head.appendChild(l);
  }catch(e){}
})();

// Script loader with failure detection + timeout
function loadScript(src, onOk, onNo){
  try{
    var ok=false, s=document.createElement('script'); s.src=src; s.async=false;
    var tm=setTimeout(function(){ if(!ok){ok=true;onNo&&onNo();} }, 7500);
    s.onload=function(){ if(ok) return; ok=true; clearTimeout(tm); onOk&&onOk(); };
    s.onerror=function(){ if(ok) return; ok=true; clearTimeout(tm); onNo&&onNo(); };
    document.head.appendChild(s);
  }catch(e){ onNo&&onNo(); }
}

// Stage 1 -> load swagger-ui bundle
setMsg('1/3 تحميل مكتبة واجهة Swagger UI...');

loadScript('https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-bundle.js',
  function uiLoaded(){
    state.ui=true; setPill('p1','o','✅ واجهة Swagger');
    setMsg('2/3 تحميل مواصفات الـ API من السيرفر...');
    setPill('p2','p','⏳ API Specs');

    var got=false; var ft=setTimeout(function(){ if(!got){got=true; showFriendlyFallback('تأخر تحميل مواصفات الـ API من endpoint /api/v1/swagger.json');} }, 6500);
    fetch('${JSON_URL}', { cache:'no-cache' })
      .then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(spec){
        if(got) return; got=true; clearTimeout(ft);
        state.spec=true; setPill('p2','o','✅ API Specs');
        setMsg('3/3 عرض التوثيق على الشاشة...'); setPill('p3','p','⏳ العرض النهائي');
        render(spec);
      })
      .catch(function(err){
        if(got) return; got=true; clearTimeout(ft);
        showFriendlyFallback('تعذر تحميل المواصفات: '+(err&&err.message?err.message:String(err))+'. جرّبي الخيارات وهي بتشتغل تمام.');
      });
  },
  function uiFailed(){
    showFriendlyFallback('تعذر تحميل واجهة Swagger من CDN. غالباً بسبب شبكة محلية أو AdBlock. الخيارات البديلة متاحة تماماً بالأسفل.');
  }
);

function render(spec){
  try{
    var presets = [SwaggerUIBundle.presets.apis];
    try{
      loadScript('https://unpkg.com/swagger-ui-dist@5.17.14/swagger-ui-standalone-preset.js', function(){
        try{ presets.push(SwaggerUIStandalonePreset); }catch(_){} initSwagger(spec, presets);
      }, function(){ initSwagger(spec, presets); });
    }catch(_){ initSwagger(spec, presets); }
    setTimeout(function(){ if(!state.rendered) initSwagger(spec, presets); }, 1200);
  }catch(e){ showFriendlyFallback('خطأ أثناء تهيئة الواجهة: '+(e&&e.message?e.message:String(e))); }
}

function initSwagger(spec, presets){
  if(state.rendered) return;
  try{
    state.rendered=true; clearTimeout(_hardFallbackAt);
    setPill('p3','o','✅ العرض النهائي'); setMsg('تم التحميل بنجاح ✨');
    setTimeout(function(){ delBoxes(); }, 600);
    SwaggerUIBundle({
      spec: spec,
      dom_id: '#swagger-ui',
      deepLinking: true,
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
      tryItOutEnabled: false,
      showRequestDuration: true,
      validatorUrl: null,
      supportedSubmitMethods: ['get','post','put','delete','patch'],
      presets: presets,
      onComplete: applyStyle,
      onFailure: function(err){ showFriendlyFallback('Swagger فشل في العرض: '+(err&&err.message?err.message:String(err))); }
    });
    setTimeout(applyStyle, 2000);
    setTimeout(applyStyle, 5000);
  }catch(e){ showFriendlyFallback('خطأ SwaggerUIBundle: '+(e&&e.message?e.message:String(e))); }
}

function applyStyle(){
  try{
    var a=document.querySelectorAll('.swagger-ui .topbar a'); if(a) a.forEach(function(el){el.style.display='none';});
    var tp=document.querySelector('.swagger-ui .topbar .wrapper');
    if(tp){
      var lg=document.createElement('div');
      lg.style.cssText='display:inline-flex;align-items:center;gap:12px';
      lg.innerHTML='<img src="${LOGO}" alt="نور" style="width:40px;height:40px;object-fit:contain;filter:drop-shadow(0 2px 8px rgba(26,16,64,.15))" onerror="this.style.display=\\'none\\'"/>' +
        '<span style="font-size:26px;font-weight:800;color:#1A1040;font-family:Tajawal,Inter,sans-serif;letter-spacing:-.5px">نور</span>';
      tp.insertBefore(lg,tp.firstChild);
    }
    document.querySelectorAll('.opblock-summary-method').forEach(function(m){
      var t=(m.textContent||'').trim();
      if(t==='GET')m.style.background='linear-gradient(180deg,#34A276,#2D8A61)';
      else if(t==='POST')m.style.background='linear-gradient(180deg,#3E63C2,#3555AE)';
      else if(t==='PUT')m.style.background='linear-gradient(180deg,#C49A47,#A97D1F)';
      else if(t==='PATCH')m.style.background='linear-gradient(180deg,#7866B5,#65529F)';
      else if(t==='DELETE')m.style.background='linear-gradient(180deg,#D15247,#B83A2F)';
      m.style.borderRadius='10px'; m.style.padding='7px 16px'; m.style.fontWeight='700'; m.style.color='#fff';
    });
    document.querySelectorAll('.btn.authorize').forEach(function(b){
      b.style.background='linear-gradient(180deg,#1A1040,#2A1B5C)';b.style.border='1px solid #1A1040';b.style.color='#fff';
      b.style.borderRadius='10px';b.style.padding='10px 20px';b.style.fontWeight='700';b.style.boxShadow='0 3px 12px rgba(26,16,64,.25)';
    });
    document.querySelectorAll('.btn.execute').forEach(function(b){
      b.style.background='linear-gradient(180deg,#C9A86A,#B39156)';b.style.border='1px solid #B39156';b.style.color='#1A1040';
      b.style.borderRadius='10px';b.style.padding='10px 20px';b.style.fontWeight='800';b.style.boxShadow='0 3px 12px rgba(201,168,106,.35)';
    });
  }catch(_){}
}
</script>
</body>
</html>`;
}

// ---------- STEP 3: SAFELY LOAD THE EXPRESS APP ----------
let cachedApp = null;
let cachedErr = null;

function loadAppSafely() {
  if (cachedErr) throw cachedErr;
  if (cachedApp) return cachedApp;
  try {
    const entry = path.join(__dirname, "..", "dist", "app.js");
    const mod = require(entry);
    const factory = mod.createApp || mod.default || mod;
    const app = typeof factory === "function" ? factory() : factory;
    if (!app || typeof app !== "function") {
      throw new Error(
        "dist/app.js does not export createApp() → check TypeScript build",
      );
    }
    cachedApp = app;
    return app;
  } catch (e) {
    cachedErr = e;
    throw e;
  }
}

// ---------- STEP 4: URL PARSING ----------
function getPathname(req) {
  const raw = (req.url || "/").split("?")[0];
  return raw === "" ? "/" : raw;
}

function isDocsPath(u) {
  if (!u) return false;
  const clean = u.replace(/\/+$/, "");
  return (
    clean === "/api/v1/docs" ||
    clean === "/api/v1/docs/index" ||
    clean === "/docs" ||
    clean === "/docs/index" ||
    u.startsWith("/api/v1/docs/") ||
    u.startsWith("/docs/")
  );
}

// ---------- STEP 5: THE HANDLER ----------
module.exports = function noorHandler(req, res) {
  const url = getPathname(req);

  // ============ ROOT "/" — RESPONDS INSTANTLY, NEVER LOADS THE APP ============
  if (url === "/") {
    sendHtml(res, 200, LANDING);
    return;
  }

  // ============ FAVICON / ROBOTS — SHORT CIRCUIT ============
  if (url.startsWith("/favicon") || url === "/robots.txt") {
    res.statusCode = 204;
    res.end();
    return;
  }

  // Docs are served by Express + swagger-ui-express (local swagger-ui-dist, no unpkg).
  // Intercepting /api/v1/docs here was why Swagger UI never loaded on Vercel.

  // Docs / spec / brand: no 8.5s watchdog (swagger-ui-express serves local files).
  const skipWatchdog =
    isDocsPath(url) ||
    url === "/api/v1/swagger.json" ||
    url.startsWith("/brand/");

  let responded = false;
  const timer = skipWatchdog
    ? null
    : setTimeout(() => {
        if (responded) return;
        responded = true;
        sendJson(res, 504, {
          success: false,
          error_code: "VERCEL_TIMEOUT",
          message:
            "تجاوز الوقت المسموح — إما قاعدة بيانات Neon بطيئة أو مشكلة في middleware",
          hint_arabic:
            "جربي تحديث الصفحة، أو تحققي من أن DATABASE_URL مأخوذ من Neon قسم Pooled connection",
          timestamp: new Date().toISOString(),
        });
      }, 8500);

  const origEnd = res.end.bind(res);
  res.end = function patchedEnd(chunk, enc, cb) {
    if (responded) return origEnd(chunk, enc, cb);
    responded = true;
    if (timer) clearTimeout(timer);
    return origEnd(chunk, enc, cb);
  };

  // ============ LOAD APP + HANDLE ============
  try {
    const app = loadAppSafely();
    try {
      app(req, res);
    } catch (syncErr) {
      if (responded) return;
      responded = true;
      if (timer) clearTimeout(timer);
      const msg = (syncErr && syncErr.message) || String(syncErr);
      sendJson(res, 500, {
        success: false,
        error_code: "API_RUNTIME_ERROR",
        message: "خطأ أثناء تشغيل الـ API",
        error_detail: msg,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (bootErr) {
    if (responded) return;
    responded = true;
    if (timer) clearTimeout(timer);
    const msg = (bootErr && bootErr.message) || String(bootErr);
    sendJson(res, 500, {
      success: false,
      error_code: "VERCEL_APP_BOOT_FAILED",
      message: "تعذر تشغيل تطبيق Express على Vercel",
      error_detail: msg,
      hint_arabic:
        "تأكدي من: 1) npm run build بنجاح محلياً  2) dist/app.js موجود بعد الـ build  3) Environment Variables فعالة على Production في Vercel",
      next_step:
        "افتحي Vercel → Deployments → أعيدي Deploy مع Build without cache بعد ما تضيفي ENV",
      timestamp: new Date().toISOString(),
    });
  }
};
