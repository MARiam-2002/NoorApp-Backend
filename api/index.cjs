"use strict";
const path = require("node:path");

const LANDING = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b7a5c"><title>Noor API | توثيق API</title><style>:root{--g:#10b981;--g2:#34d399;--gd:#fbbf24;--t:#e6eaf2;--m:#93a0b8}*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,"Noto Sans Arabic",sans-serif;color:var(--t);background:radial-gradient(1200px 600px at 20% -10%,#0e3a2e,transparent 60%),radial-gradient(900px 500px at 110% 10%,#1a2a5c,transparent 55%),linear-gradient(180deg,#070a18,#0a0f22)}main{max-width:920px;margin:0 auto;padding:56px 24px 80px}.b{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--g2);font-weight:600;font-size:13px;border:1px solid rgba(16,185,129,.28)}.d{width:8px;height:8px;border-radius:50%;background:var(--g);box-shadow:0 0 0 4px rgba(16,185,129,.18);animation:p 1.6s infinite}@keyframes p{0%,100%{opacity:1}50%{opacity:.5}}h1{font-size:44px;line-height:1.15;margin:18px 0 10px;background:linear-gradient(90deg,#fff,#86efac 40%,#fde68a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}.l{font-size:18px;color:var(--m);margin:0 0 28px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px 0 36px}.c{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;transition:.25s ease}.c:hover{transform:translateY(-3px);border-color:rgba(16,185,129,.45)}.c h3{margin:0 0 6px;font-size:18px;color:#fff}.c p{margin:0 0 14px;color:var(--m);font-size:14.5px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;transition:.2s ease;border:1px solid transparent}.btn.p{background:linear-gradient(180deg,var(--g),#059669);color:#052e22}.btn.p:hover{filter:brightness(1.05)}.btn.o{background:transparent;border-color:rgba(255,255,255,.12);color:var(--t)}.btn.o:hover{background:rgba(255,255,255,.04)}.s{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--m);margin-top:8px;flex-wrap:wrap}.pi{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(251,191,36,.12);color:var(--gd);font-size:12px;border:1px solid rgba(251,191,36,.3)}footer{margin-top:32px;color:var(--m);font-size:13px;opacity:.85}code{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;font-size:13px;color:#c7d2fe}@media(max-width:520px){h1{font-size:32px}}</style></head><body><main><span class="b"><span class="d"></span> الخدمة تعمل — API Online</span><h1>Noor API ✨<br/>واجهة برمجة تطبيقات نور</h1><p class="l">نسخة <b>v1.0.0</b> — القرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · رحلة إسلامية يومية كاملة لتطبيق Flutter.</p><div class="g"><div class="c"><span class="pi">Swagger / OpenAPI</span><h3>📚 التوثيق التفاعلي</h3><p>جرب جميع الـ endpoints مباشرة من المتصفح مع وصف عربي لكل طلب واستجابة.</p><a class="btn p" href="/api/v1/docs">افتح التوثيق ↗</a></div><div class="c"><span class="pi">Monitoring</span><h3>🩺 فحص صحة الخدمة</h3><p>تأكد من أن قاعدة البيانات والخدمة تعمل بشكل سليم (Health Check).</p><a class="btn o" href="/api/v1/health">/api/v1/health ↗</a></div><div class="c"><span class="pi">Discover</span><h3>🧭 روابط سريعة للمطورين</h3><p>أشهر الـ endpoints التي يحتاجها فريق Flutter للبدء فوراً.</p><div style="display:flex;flex-wrap:wrap;gap:8px"><code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code></div></div></div><div class="s"><span>Base URL للاستخدام في تطبيق Flutter:</span><code>https://noor-app-backend-one.vercel.app/api/v1</code></div><footer>© ${new Date().getFullYear()} Noor App — Express · TypeScript · Prisma · Neon PostgreSQL · Vercel</footer></main></body></html>`;

let cachedApp = null;
let bootError = null;

function loadApp() {
  if (bootError) throw bootError;
  if (cachedApp) return cachedApp;
  try {
    const entry = path.join(__dirname, "..", "dist", "app.js");
    const mod = require(entry);
    const factory = mod.createApp || mod.default || mod;
    cachedApp = typeof factory === "function" ? factory() : factory;
    if (!cachedApp || typeof cachedApp !== "function") {
      throw new Error(
        "Invalid app export from dist/app.js (expected createApp() → function)",
      );
    }
    return cachedApp;
  } catch (err) {
    bootError = err;
    throw err;
  }
}

function respondHtml(res, status, html) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader(
    "Cache-Control",
    "public, max-age=20, s-maxage=60, stale-while-revalidate=86400",
  );
  res.end(html);
}

function respondJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(body, null, 2));
}

const ROUTES = {
  docs: "/api/v1/docs",
  health: "/api/v1/health",
  root: "/",
};

function getPath(req) {
  const raw = (req.url || "/").split("?")[0];
  if (raw === "") return "/";
  return raw;
}

function fallbackHtmlForError(originalErrMsg) {
  const hint = encodeURIComponent(
    originalErrMsg || "Startup error — check Vercel env vars",
  );
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>⚠ Noor API — خطأ في التشغيل</title><style>body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,sans-serif;background:linear-gradient(180deg,#0b1020,#121a33);color:#e6eaf2;display:flex;align-items:center;justify-content:center;padding:24px}.card{max-width:620px;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.1);border-radius:20px;padding:32px}.pill{display:inline-block;padding:4px 12px;border-radius:999px;background:rgba(251,191,36,.15);color:#fde68a;font-weight:700;font-size:12px;border:1px solid rgba(251,191,36,.35)}h1{margin:14px 0 6px;font-size:30px;color:#fff}p{color:#93a0b8;line-height:1.7}code{font-family:ui-monospace,Consolas,monospace;background:rgba(255,255,255,.08);padding:2px 8px;border-radius:6px;font-size:13.5px;color:#c7d2fe;word-break:break-all;display:inline-block;margin:3px 4px 3px 0}.row{display:flex;gap:10px;flex-wrap:wrap;margin-top:14px}a.btn{display:inline-flex;align-items:center;justify-content:center;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;border:1px solid transparent;transition:.2s}a.p{background:#10b981;color:#052e22}a.o{background:transparent;border-color:rgba(255,255,255,.15);color:#e6eaf2}.err{margin-top:20px;padding:14px;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:14px;font-family:ui-monospace,Consolas,monospace;color:#fca5a5;font-size:13px;white-space:pre-wrap;word-break:break-word}</style></head><body><div class="card"><span class="pill">⚠ خطأ أثناء تشغيل التطبيق على Vercel</span><h1>مشكلة في متغيرات البيئة (Environment Variables)</h1><p>الرئيسية اشتغلت تمام (ده أثبت إن الـ handler شغال ✅)، لكن لما حاولنا نحمل باقي الـ API حصل خطأ. السبب دايماً في 2026 بيكون:<br/><br/>• إما إن الـ 4 متغيرات تحت <b>مش موجودة</b> أو <b>مفعلة على Preview مش Production</b><br/>• أو إن الـ <code>DATABASE_URL</code> مظبوطةش صح من Neon</p><div><code>DATABASE_URL</code><code>JWT_SECRET</code><code>JWT_REFRESH_SECRET</code><code>NODE_ENV=production</code></div><div class="row"><a class="btn p" target="_blank" href="https://vercel.com/">افتحي Vercel Dashboard → Settings → Environment Variables ↗</a><a class="btn o" href="https://noor-app-backend-one.vercel.app/">جربي تاني / الرئيسية ↻</a></div><details style="margin-top:22px"><summary style="cursor:pointer;color:#c7d2fe;font-weight:600">اظهار تفاصيل الخطأ للتشخيص:</summary><div class="err">${(originalErrMsg || "No error message").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" })[c])}</div></details></div></body></html>`;
}

module.exports = async function noorHandler(req, res) {
  const url = getPath(req);

  // ——————————————————————————————————————————————————————————
  // 1) ROOT URL → ALWAYS renders static landing FIRST.
  //    This is a Vercel 2026 pattern: we NEVER wait for dist/app.js
  //    to render the landing page. Zero external deps.
  // ——————————————————————————————————————————————————————————
  if (url === ROUTES.root || url === "") {
    try {
      respondHtml(res, 200, LANDING);
      return;
    } catch (_htmlErr) {
      try {
        respondJson(res, 200, {
          success: true,
          message: "Noor API شغالة",
          docs: ROUTES.docs,
          health: ROUTES.health,
          base: "/api/v1",
          timestamp: new Date().toISOString(),
        });
        return;
      } catch (_jsonErr) {
        res.statusCode = 200;
        res.end("Noor API OK");
        return;
      }
    }
  }

  // ——————————————————————————————————————————————————————————
  // 2) Favicon / shortcuts → short-circuit 204
  // ——————————————————————————————————————————————————————————
  if (url.startsWith("/favicon")) {
    res.statusCode = 204;
    res.end();
    return;
  }

  // ——————————————————————————————————————————————————————————
  // 3) All other URLs: attempt to load Express app;
  //    ON ANY ERROR return HTML page or JSON — NEVER grey spinner
  // ——————————————————————————————————————————————————————————
  try {
    const app = loadApp();
    app(req, res);
    return;
  } catch (err) {
    const msg = (err && err.message) || String(err) || "Unknown startup error";
    try {
      // Health/Docs URLs give friendly HTML with Arabic hint + real error details
      if (
        url === ROUTES.health ||
        url === ROUTES.docs ||
        url.startsWith("/api/v1/docs")
      ) {
        respondHtml(res, 500, fallbackHtmlForError(msg));
        return;
      }
      // API-style URLs give JSON with hint
      respondJson(res, 500, {
        success: false,
        message: "تعذر تشغيل الـ API على Vercel",
        error_code: "VERCEL_STARTUP_FAILED",
        error_detail: msg,
        hint_arabic:
          "دخلي Vercel → Settings → Environment Variables. أضيفي أو صححي الأربع دول ومفعليهم على Production مش Preview: DATABASE_URL ، JWT_SECRET ، JWT_REFRESH_SECRET ، NODE_ENV = production",
        hint: "Open Vercel → Project Settings → Environment Variables. These 4 must exist and be checked for Production: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV=production",
        timestamp: new Date().toISOString(),
      });
      return;
    } catch (_fatal) {
      res.statusCode = 500;
      res.end(
        "Startup failed. Please set Vercel env vars: DATABASE_URL JWT_SECRET JWT_REFRESH_SECRET NODE_ENV=production",
      );
      return;
    }
  }
};
