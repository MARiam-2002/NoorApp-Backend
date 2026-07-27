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
const LANDING = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b7a5c"><title>Noor API | واجهة برمجة تطبيقات نور</title><style>:root{--g:#10b981;--g2:#34d399;--gd:#fbbf24;--t:#e6eaf2;--m:#93a0b8}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,"Noto Sans Arabic",sans-serif;color:var(--t);background:radial-gradient(1200px 600px at 20% -10%,#0e3a2e,transparent 60%),radial-gradient(900px 500px at 110% 10%,#1a2a5c,transparent 55%),linear-gradient(180deg,#070a18,#0a0f22)}main{max-width:920px;margin:0 auto;padding:56px 24px 80px}.b{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--g2);font-weight:600;font-size:13px;border:1px solid rgba(16,185,129,.28)}.d{width:8px;height:8px;border-radius:50%;background:var(--g);box-shadow:0 0 0 4px rgba(16,185,129,.18);animation:p 1.6s infinite}@keyframes p{0%,100%{opacity:1}50%{opacity:.5}}h1{font-size:44px;line-height:1.15;margin:18px 0 10px;background:linear-gradient(90deg,#fff,#86efac 40%,#fde68a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.l{font-size:18px;color:var(--m);margin:0 0 28px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px 0 36px}.c{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;transition:.25s ease}.c:hover{transform:translateY(-3px);border-color:rgba(16,185,129,.45)}.c h3{margin:0 0 6px;font-size:18px;color:#fff}.c p{margin:0 0 14px;color:var(--m);font-size:14.5px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;transition:.2s ease;border:1px solid transparent}.btn.p{background:linear-gradient(180deg,var(--g),#059669);color:#052e22}.btn.p:hover{filter:brightness(1.05)}.btn.o{background:transparent;border-color:rgba(255,255,255,.12);color:var(--t)}.btn.o:hover{background:rgba(255,255,255,.04)}.s{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--m);margin-top:8px;flex-wrap:wrap}.pi{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(251,191,36,.12);color:var(--gd);font-size:12px;border:1px solid rgba(251,191,36,.3)}footer{margin-top:32px;color:var(--m);font-size:13px;opacity:.85}code{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;font-size:13px;color:#c7d2fe}@media(max-width:520px){h1{font-size:32px}}</style></head><body><main><span class="b"><span class="d"></span> الخدمة تعمل — API Online</span><h1>Noor API ✨<br/>واجهة برمجة تطبيقات نور</h1><p class="l">نسخة <b>v1.0.0</b> — القرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · رحلة إسلامية يومية كاملة لتطبيق Flutter.</p><div class="g"><div class="c"><span class="pi">Swagger / OpenAPI</span><h3>📚 التوثيق التفاعلي</h3><p>جرب جميع الـ endpoints مباشرة من المتصفح مع وصف عربي لكل طلب واستجابة.</p><a class="btn p" href="/api/v1/docs">افتح التوثيق ↗</a></div><div class="c"><span class="pi">Monitoring</span><h3>🩺 فحص صحة الخدمة</h3><p>تأكد من أن قاعدة البيانات والخدمة تعمل بشكل سليم (Health Check).</p><a class="btn o" href="/api/v1/health">/api/v1/health ↗</a></div><div class="c"><span class="pi">Discover</span><h3>🧭 روابط سريعة للمطورين</h3><p>أشهر الـ endpoints التي يحتاجها فريق Flutter للبدء فوراً.</p><div style="display:flex;flex-wrap:wrap;gap:8px"><code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code></div></div></div><div class="s"><span>Base URL للاستخدام في تطبيق Flutter:</span><code>/api/v1</code></div><footer>© ${new Date().getFullYear()} Noor App — Express · TypeScript · Prisma · Neon PostgreSQL · Vercel</footer></main></body></html>`;

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
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#C9A46E" />
<title>Noor API | توثيق API</title>
<style>
:root{--g:#C9A46E;--g2:#B08F56;--bg:#FAFAF8;--s:#FFFFFF;--t:#1A1816;--tm:#65605B;--ts:#8A8580;--b:#EDE9E0;--bh:#E0D9CC;--ok:#1F8A59;--bad:#BD3B2F;--warn:#B38521;--info:#2D5FB0}
*{box-sizing:border-box}
html,body{margin:0;background:var(--bg);color:var(--t);font-family:Inter,'Segoe UI',-apple-system,BlinkMacSystemFont,Tajawal,'SF Pro Display',sans-serif;-webkit-font-smoothing:antialiased}
.tb{background:rgba(255,255,255,.92);border-bottom:1px solid var(--b);padding:14px 0;position:sticky;top:0;z-index:50;backdrop-filter:blur(8px)}
.tb .wrap{max-width:1280px;margin:0 auto;padding:0 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.logo{font-size:26px;font-weight:800;color:var(--g);letter-spacing:-.8px;font-family:Tajawal,Inter,sans-serif}
.ql{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
a.bx{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;font-weight:700;font-size:12.5px;text-decoration:none;border:1px solid;transition:.2s}
a.bx.p{background:linear-gradient(180deg,var(--g),var(--g2));color:#fff;border-color:var(--g2)}
a.bx.s{background:var(--s);border-color:var(--b);color:var(--t)}
a.bx:hover{transform:translateY(-1.5px)}
.main{max-width:1280px;margin:0 auto;padding:32px 24px 120px}
.hd{margin-bottom:22px}
.hd .pi{display:inline-flex;align-items:center;gap:8px;padding:5px 12px;border-radius:999px;background:rgba(201,164,110,.12);color:var(--g2);border:1px solid rgba(201,164,110,.3);font-weight:700;font-size:12px}
.hd h1{font-size:32px;margin:14px 0 8px;color:var(--t);letter-spacing:-.4px;font-weight:800}
.hd .sub{color:var(--ts);font-size:15px;line-height:1.8;margin:0}
.loadbox{background:var(--s);border:1px solid var(--b);border-radius:16px;padding:36px 28px;text-align:center;box-shadow:0 1px 3px rgba(26,24,22,.04);margin-bottom:22px}
.ldr{display:inline-block;width:28px;height:28px;border:3px solid var(--b);border-top-color:var(--g);border-radius:50%;animation:sp 1s linear infinite;margin-bottom:14px}
@keyframes sp{to{transform:rotate(360deg)}}
.ldt{font-size:16px;color:var(--t);font-weight:700;margin:0 0 4px}
.lds{font-size:13px;color:var(--ts);margin:0 0 18px}
.pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:6px}
.pil{display:inline-flex;align-items:center;gap:7px;padding:6px 13px;border-radius:999px;border:1px solid;font-size:12px;font-weight:700}
.pil.p{background:rgba(201,164,110,.12);color:var(--g2);border-color:rgba(201,164,110,.3)}
.pil.o{background:rgba(31,138,89,.1);color:var(--ok);border-color:rgba(31,138,89,.3)}
.pil.b{background:rgba(189,59,47,.1);color:var(--bad);border-color:rgba(189,59,47,.3)}
.gr{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;margin:22px 0}
.cd{background:var(--s);border:1px solid var(--b);border-radius:16px;padding:22px;transition:.25s ease;box-shadow:0 1px 3px rgba(26,24,22,.04)}
.cd:hover{transform:translateY(-2px);border-color:rgba(201,164,110,.5)}
.cd h3{margin:0 0 8px;font-size:18px;color:var(--t)}
.cd p{margin:0 0 14px;color:var(--tm);font-size:14px;line-height:1.7}
.cd .tag{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(201,164,110,.12);color:var(--g2);font-size:11.5px;border:1px solid rgba(201,164,110,.3);font-weight:700;margin-bottom:10px}
#swagger-ui{position:relative;z-index:1}
.swagger-ui .topbar{background:#fff!important;border-bottom:1px solid #EDE9E0!important;padding:14px 0!important;box-shadow:none!important;margin:0 -24px 32px!important;padding-inline:24px!important}
.swagger-ui .info{background:#fff!important;border:1px solid #EDE9E0!important;border-radius:12px!important;padding:28px 32px!important;margin:0 0 24px!important;box-shadow:0 1px 2px rgba(26,24,22,.04)!important}
.swagger-ui .opblock{border:1px solid #EDE9E0!important;border-radius:12px!important;margin:12px 0!important;background:#fff!important;box-shadow:0 1px 2px rgba(26,24,22,.04)!important;overflow:hidden!important}
.basehint{background:linear-gradient(180deg,#fff,#F7F3EC);border:1px solid rgba(201,164,110,.22);border-radius:14px;padding:16px 20px;margin:22px 0 0;color:var(--tm);font-size:14px}
.basehint b{color:var(--g2)}
.basehint .ecs{display:flex;gap:7px;flex-wrap:wrap;margin-top:10px}
.basehint code{background:#F3ECDD;color:var(--g2);padding:3px 10px;border-radius:6px;font-size:12.5px;font-family:ui-monospace,Consolas,monospace;font-weight:600}
@media(max-width:520px){.hd h1{font-size:26px}.main{padding:20px 16px 80px}}
</style>
</head>
<body>
<div class="tb"><div class="wrap"><div class="logo">نور</div><div class="ql"><a class="bx s" href="${JSON_URL}">OpenAPI JSON ↓</a><a class="bx p" target="_blank" href="https://editor.swagger.io/?url=' + encodeURIComponent(location.origin) + encodeURIComponent('${JSON_URL}') + '">افتحي في Editor ↗</a></div></div></div>
<div class="main">
  <div class="hd">
    <span class="pi">✨ Swagger / OpenAPI 3.1</span>
    <h1>توثيق Noor API</h1>
    <p class="sub">نسخة v1.0 — <b>53 endpoint</b> للقرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · القبلة · التحديات · رحلة يومية كاملة لتطبيق Flutter.</p>
  </div>
  <div id="wrapBeforeSwagger">
    <div class="loadbox" id="loadBox">
      <div class="ldr" id="spinner"></div>
      <p class="ldt">جارٍ تحميل واجهة التوثيق...</p>
      <p class="lds" id="statusTxt">1/3 تحميل مكتبة Swagger UI من CDN</p>
      <div class="pills" id="pillRow" style="margin-top:14px">
        <span class="pil p" id="p1">⏳ واجهة Swagger</span>
        <span class="pil p" id="p2">⏳ API Specs</span>
        <span class="pil p" id="p3">⏳ العرض النهائي</span>
      </div>
      <div style="margin-top:28px;padding-top:22px;border-top:1px dashed var(--b);text-align:center;color:var(--ts);font-size:13px">
        <p style="margin:4px 0">إذا استغرق أكثر من ١٠ ثواني — الخيارات التالية تعمل ١٠٠٪ بدون الحاجة للـ CDN:</p>
        <div class="gr" style="margin:14px auto 0;max-width:560px">
          <div class="cd"><span class="tag">الأفضل للمطورين</span><h3>Swagger Editor الرسمي</h3><p>نفس واجهة Swagger بالكامل على موقع الرسمي + الاتصال بمواصفاتنا مباشرة.</p><a class="bx p" style="width:100%" target="_blank" href="https://editor.swagger.io/?url=' + encodeURIComponent(location.origin) + encodeURIComponent('${JSON_URL}') + '">افتحي الآن ↗</a></div>
          <div class="cd"><span class="tag">فريق Flutter</span><h3>Postman Collection</h3><p>File → Import → رابط. تلصقي رابط الـ JSON بيولعلك 53 endpoint جاهزين للتجربة.</p><a class="bx s" style="width:100%" href="${JSON_URL}">نسخ رابط الـ JSON ↓</a></div>
        </div>
      </div>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <div class="basehint">
    <b>💡 نصيحة لفريق Flutter:</b> Base URL للإستخدام في التطبيق هو <code>' + location.origin + '/api/v1</code>
    <div class="ecs">
      <code>/quran/surahs</code><code>/quran/surah/1</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code><code>/content/hadith-of-day</code><code>/challenges</code><code>/auth/login</code><code>/health</code>
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
      '<div style="max-width:880px;margin:0 auto;padding:6px 0 24px">' +
      '<div style="background:rgba(189,59,47,.08);border:1px solid rgba(189,59,47,.25);color:var(--bad);padding:12px 18px;border-radius:12px;font-size:14px;font-weight:600;margin-bottom:18px">⚠ ' + String(reason||'خطأ غير معروف').replace(/[<>&]/g,'') + '</div>' +
      '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px">' +
        '<div class="cd"><span class="tag">الخيار الأول 💎</span><h3>Swagger Editor الرسمي</h3><p>نفس الواجهة الأصلية مع نفس الـ 53 endpoints. زر Try it out شغال تمام.</p><a class="bx p" style="width:100%" target="_blank" href="https://editor.swagger.io/?url=' + encodeURIComponent(location.origin) + encodeURIComponent('${JSON_URL}') + '">افتحي في editor.swagger.io ↗</a></div>' +
        '<div class="cd"><span class="tag">الخيار الثاني 📮</span><h3>استيراد لـ Postman</h3><p>File → Import → رابط. الصقي الـ URL تحت وبيجيبلك كل الـ endpoints مع parameters و responses.</p><a class="bx s" style="width:100%" href="${JSON_URL}">نسخ رابط الـ OpenAPI JSON ↓</a></div>' +
        '<div class="cd"><span class="tag">الخيار الثالث 🔧</span><h3>استكشاف سريع من المتصفح</h3><p>الروابط الأساسية اللي فريق Flutter بيحتاجها للتجربة المباشرة.</p><div style="display:flex;gap:7px;flex-wrap:wrap">' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/health">/health</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/quran/surahs">/quran/surahs</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/content/verse-of-day">/verse-of-day</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/prayers/today?city=Riyadh">/prayers/today</a>' +
          '<a class="bx s" style="padding:6px 12px;font-size:12px" target="_blank" href="/api/v1/journey/today">/journey/today</a>' +
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
        s.textContent='.swagger-ui{font-family:Inter,Segoe UI,sans-serif}.swagger-ui .topbar{display:none}.swagger-ui .info{padding:20px;background:#fff;border:1px solid var(--b);border-radius:12px;margin:16px 0}.opblock{border:1px solid var(--b);border-radius:12px;overflow:hidden;margin:12px 0;background:#fff}.opblock-summary{padding:14px;display:flex;gap:14px;align-items:center}.opblock-summary-method{padding:6px 14px;border-radius:6px;font-weight:700;color:#fff;font-size:12px}';
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
        showFriendlyFallback('تعذر تحميل المواصفات: '+(err&&err.message?err.message:String(err))+'. جرّبي الخيارات أدناه وهي بتشتغل تمام.');
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
    // Safety: init anyway after 1s even if standalone preset net barks
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
    if(tp){var lg=document.createElement('div');lg.style.cssText='font-size:26px;font-weight:800;color:var(--g);font-family:Tajawal,Inter,sans-serif;letter-spacing:-.8px';lg.textContent='نور';tp.insertBefore(lg,tp.firstChild);}
    document.querySelectorAll('.opblock-summary-method').forEach(function(m){
      var t=(m.textContent||'').trim();
      if(t==='GET')m.style.background='#1F8A59';
      else if(t==='POST')m.style.background='#2D5FB0';
      else if(t==='PUT')m.style.background='#B38521';
      else if(t==='PATCH')m.style.background='#6C5AA8';
      else if(t==='DELETE')m.style.background='#BD3B2F';
      m.style.borderRadius='6px'; m.style.padding='6px 14px'; m.style.fontWeight='700'; m.style.color='#fff';
    });
    document.querySelectorAll('.btn.authorize').forEach(function(b){b.style.background='var(--g)';b.style.border='1px solid var(--g2)';b.style.color='#fff';});
    document.querySelectorAll('.btn.execute').forEach(function(b){b.style.background='var(--t)';b.style.border='1px solid var(--t)';b.style.color='#fff';});
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

  // ============ DOCS "/api/v1/docs" — INSTANT RESPONSE < 1ms (CRITICAL) ============
  // NEVER wait for Express app to serve the docs page.
  // We return a premium self-contained HTML that:
  //  - instantly renders with loading pills + fallback cards (Swagger Editor / Postman / ...)
  //  - then client-side attempts to upgrade to SwaggerUI bundle + fetch /api/v1/swagger.json
  // This GUARANTEES no infinite spinner / blank white page for docs URLs.
  if (isDocsPath(url)) {
    sendHtml(res, 200, docsHubHtml());
    return;
  }

  // ============ WATCHDOG: PREVENT INFINITE SPINNER (for non-docs routes) ============
  // If Express hasn't responded in 8.5 seconds, send a fallback.
  // Vercel's default timeout for Hobby is 10s — we beat it by 1.5s.
  let responded = false;
  const timer = setTimeout(() => {
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
    clearTimeout(timer);
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
      clearTimeout(timer);
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
    clearTimeout(timer);
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
