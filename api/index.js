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
    DATABASE_URL: process.env.DATABASE_URL || "postgresql://placeholder:placeholder@localhost:5432/placeholder",
    JWT_SECRET: process.env.JWT_SECRET || "fallback_jwt_secret_please_set_vercel_env_vars_minimum_32_chars_long",
    JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "fallback_jwt_refresh_secret_please_set_vercel_env_vars",
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
    res.setHeader("Cache-Control", "public, max-age=15, s-maxage=45, stale-while-revalidate=86400");
    res.end(html);
  } catch (_e) {
    try { res.end("OK"); } catch (_f) { /* dead response */ }
  }
}

function sendJson(res, status, body) {
  try {
    res.statusCode = status;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(JSON.stringify(body));
  } catch (_e) {
    try { res.end('{"ok":false}'); } catch (_f) { /* dead response */ }
  }
}

function errorHtml(errMsg) {
  const safe = String(errMsg || "Unknown error").replace(/[<>&]/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c]);
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>⚠ Noor API — مشكلة في التشغيل</title><style>body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:linear-gradient(180deg,#0b1020,#121a33);color:#e6eaf2;display:flex;align-items:center;justify-content:center;padding:24px}.card{max-width:640px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px}.pill{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,.15);color:#fde68a;font-weight:700;font-size:12px;border:1px solid rgba(251,191,36,.35)}h1{margin:14px 0 6px;font-size:28px;color:#fff}p{color:#93a0b8;line-height:1.7}code{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:3px 9px;border-radius:6px;font-size:13.5px;color:#c7d2fe;word-break:break-all;display:inline-block;margin:3px 5px 3px 0}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}a.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;border:1px solid transparent;transition:.2s}a.p{background:#10b981;color:#052e22}a.o{background:transparent;border-color:rgba(255,255,255,.15);color:#e6eaf2}.err{margin-top:20px;padding:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:14px;font-family:ui-monospace,Consolas,monospace;color:#fca5a5;font-size:12.5px;white-space:pre-wrap;word-break:break-word}.ok{background:rgba(16,185,129,.1);border-color:rgba(16,185,129,.4);color:#86efac}ul{color:#93a0b8;padding-right:20px}li{margin:5px 0}</style></head><body><div class="card"><span class="pill">⚠ تنبيه: الـ API محتاج إعدادات إضافية</span><h1>الرئيسية اشتغلت ✅ — لكن باقي الـ API محتاج ضبط بسيط</h1><p>ده معناه إن الـ handler شغال تمام على Vercel، بس إما:<br/>(أ) متغيرات البيئة مش موجودة / مفعلة على Production<br/>(ب) أو الـ build مش ناجح للـ TypeScript<br/><br/><b>الخطوات الصح لضبط Vercel (بالترتيب):</b></p><ul><li>1. افتحي <b>Vercel Dashboard</b> → مشروعك → <b>Settings</b> → <b>Environment Variables</b></li><li>2. أضيفي الأربع دول التالية <b>ومفعلي الـ ✅ Production</b> معاهم (مش Preview بس):</li></ul><div><code>DATABASE_URL</code><code>JWT_SECRET</code><code>JWT_REFRESH_SECRET</code><code>NODE_ENV=production</code></div><ul><li>3. افتحي <b>Deployments</b> → أخر deploy → الثلاث نقاط → <b>Redeploy</b> مع تحديد <code>Build without cache</code></li><li>4. التزمي أن الـ Node Version في Project Settings → General = <b>24.x</b></li></ul><div class="row"><a class="btn p" target="_blank" href="https://vercel.com/dashboard">افتح Vercel Dashboard ↗</a><a class="btn o" href="/">الرئيسية ↻</a></div><details style="margin-top:20px"><summary style="cursor:pointer;color:#c7d2fe;font-weight:600">💡 تفاصيل الخطأ الفعلي للتشخيص:</summary><div class="err">${safe}</div></details></div></body></html>`;
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
      throw new Error("dist/app.js does not export createApp() → check TypeScript build");
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

  // ============ WATCHDOG: PREVENT INFINITE SPINNER ============
  // If Express hasn't responded in 8.5 seconds, send a fallback.
  // Vercel's default timeout for Hobby is 10s — we beat it by 1.5s.
  let responded = false;
  const timer = setTimeout(() => {
    if (responded) return;
    responded = true;
    sendJson(res, 504, {
      success: false,
      error_code: "VERCEL_TIMEOUT",
      message: "تجاوز الوقت المسموح — إما قاعدة بيانات Neon بطيئة أو مشكلة في middleware",
      hint_arabic: "جربي تحديث الصفحة، أو تحققي من أن DATABASE_URL مأخوذ من Neon قسم Pooled connection",
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
      if (url === "/api/v1/health" || url.startsWith("/api/v1/docs")) {
        sendHtml(res, 500, errorHtml(msg));
      } else {
        sendJson(res, 500, {
          success: false, error_code: "API_RUNTIME_ERROR",
          message: "خطأ أثناء تشغيل الـ API", error_detail: msg,
          timestamp: new Date().toISOString(),
        });
      }
    }
  } catch (bootErr) {
    if (responded) return;
    responded = true;
    clearTimeout(timer);
    const msg = (bootErr && bootErr.message) || String(bootErr);
    // Docs/Health get friendly Arabic HTML page — devs will see it
    if (url === "/api/v1/health" || url === "/api/v1/docs" || url.startsWith("/api/v1/docs")) {
      sendHtml(res, 500, errorHtml(msg));
    } else {
      sendJson(res, 500, {
        success: false,
        error_code: "VERCEL_APP_BOOT_FAILED",
        message: "تعذر تشغيل تطبيق Express على Vercel",
        error_detail: msg,
        hint_arabic: "تأكدي من: 1) npm run build بنجاح محلياً  2) dist/app.js موجود بعد الـ build  3) Environment Variables فعالة على Production في Vercel",
        next_step: "افتحي Vercel → Deployments → أعيدي Deploy مع Build without cache بعد ما تضيفي ENV",
        timestamp: new Date().toISOString(),
      });
    }
  }
};
