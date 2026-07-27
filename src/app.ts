import express from 'express';

import { appConfig } from './config';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/common';
import { connectDatabase } from './lib/prisma';
import { httpLogger, applySecurityMiddlewares, apiRateLimiter } from './middleware/http';
import { setupSwagger } from './lib/swagger';
import { v1Router } from './routes';

export function createApp(): express.Application {
  const app = express();

  app.use(requestIdMiddleware);
  applySecurityMiddlewares(app);

  app.use(httpLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/', (_req, res) => {
    const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#0b7a5c" />
<title>Noor API — واجهة برمجة تطبيقات نور</title>
<style>
  :root{ --bg:#0b1020; --card:#121a33; --green:#10b981; --green2:#34d399; --gold:#fbbf24; --text:#e6eaf2; --muted:#93a0b8 }
  *{box-sizing:border-box}
  body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,"Noto Sans Arabic","Arabic Typesetting",sans-serif;color:var(--text);background:radial-gradient(1200px 600px at 20% -10%, #0e3a2e 0%, transparent 60%),radial-gradient(900px 500px at 110% 10%, #1a2a5c 0%, transparent 55%),linear-gradient(180deg,#070a18 0%, #0a0f22 100%)}
  main{max-width:920px;margin:0 auto;padding:56px 24px 80px}
  .badge{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--green2);font-weight:600;font-size:13px;border:1px solid rgba(16,185,129,.28)}
  .dot{width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 0 4px rgba(16,185,129,.18);animation:p 1.6s infinite}
  @keyframes p{0%,100%{opacity:1}50%{opacity:.5}}
  h1{font-size:44px;line-height:1.15;margin:18px 0 10px;background:linear-gradient(90deg,#fff 0%, #86efac 40%, #fde68a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
  p.lead{font-size:18px;color:var(--muted);margin:0 0 28px}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px 0 36px}
  .card{background:linear-gradient(180deg, rgba(255,255,255,.04), rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;transition:.25s ease}
  .card:hover{transform:translateY(-3px);border-color:rgba(16,185,129,.45)}
  .card h3{margin:0 0 6px;font-size:18px;color:#fff}
  .card p{margin:0 0 14px;color:var(--muted);font-size:14.5px}
  .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;transition:.2s ease;border:1px solid transparent}
  .btn.primary{background:linear-gradient(180deg,var(--green),#059669);color:#052e22}
  .btn.primary:hover{filter:brightness(1.05)}
  .btn.ghost{background:transparent;border-color:rgba(255,255,255,.12);color:var(--text)}
  .btn.ghost:hover{background:rgba(255,255,255,.04)}
  .status{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--muted);margin-top:8px}
  .pill{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(251,191,36,.12);color:var(--gold);font-size:12px;border:1px solid rgba(251,191,36,.3)}
  footer{margin-top:32px;color:var(--muted);font-size:13px;opacity:.85}
  code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;font-size:13px;color:#c7d2fe}
  @media (max-width:520px){h1{font-size:32px}}
</style>
</head>
<body>
<main>
  <span class="badge"><span class="dot"></span> الخدمة تعمل — API Online</span>
  <h1>Noor API<br/>واجهة برمجة تطبيقات نور ✨</h1>
  <p class="lead">نسخة <b>v1.0.0</b> — القرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · رحلة إسلامية يومية كاملة مصممة لتطبيق Flutter.</p>

  <div class="grid">
    <div class="card">
      <span class="pill">Swagger / OpenAPI</span>
      <h3>📚 التوثيق التفاعلي</h3>
      <p>جرب جميع الـ endpoints مباشرة من المتصفح مع وصف عربي لكل طلب واستجابة.</p>
      <a class="btn primary" href="/api/v1/docs">افتح التوثيق ↗</a>
    </div>
    <div class="card">
      <span class="pill">Monitoring</span>
      <h3>🩺 فحص صحة الخدمة</h3>
      <p>تأكد من أن قاعدة البيانات والخدمة تعمل بشكل سليم (Health Check).</p>
      <a class="btn ghost" href="/api/v1/health">/api/v1/health ↗</a>
    </div>
    <div class="card">
      <span class="pill">Discover</span>
      <h3>🧭 روابط سريعة للمطورين</h3>
      <p>أشهر الـ endpoints التي يحتاجها فريق Flutter للبدء فوراً.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <code>/quran/surahs</code>
        <code>/content/verse-of-day</code>
        <code>/prayers/today</code>
        <code>/journey/today</code>
      </div>
    </div>
  </div>

  <div class="status">
    <span>Base URL للاستخدام في تطبيق Flutter:</span>
    <code>https://noor-app-backend-one.vercel.app/api/v1</code>
  </div>

  <footer>© ${new Date().getFullYear()} Noor App — بنيت بـ Express · TypeScript · Prisma · Neon PostgreSQL ومستضافة على Vercel.</footer>
</main>
</body>
</html>`;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=60, stale-while-revalidate=86400');
    res.send(html);
  });

  app.use(appConfig.apiPrefix, apiRateLimiter, v1Router);

  setupSwagger(app);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** @deprecated use createApp() — kept for server.ts local bootstrap */
export async function initializeApp(): Promise<express.Application> {
  await connectDatabase();
  return createApp();
}

// Default export - Express app handles all requests
export default createApp;
