import express from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { appConfig } from './config';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/common';
import { connectDatabase } from './lib/prisma';
import { httpLogger, applySecurityMiddlewares, apiRateLimiter } from './middleware/http';
import { setupSwagger } from './lib/swagger';
import { v1Router } from './routes';
import { logger } from './lib/logger';

let migrationsRan = false;

async function runMigrationsIfNeeded(): Promise<void> {
  if (migrationsRan) return;
  if (!appConfig.isProduction) {
    migrationsRan = true;
    return;
  }
  try {
    const prisma = new PrismaClient();
    const migrationsDir = path.resolve(process.cwd(), 'prisma', 'migrations');
    if (!fs.existsSync(migrationsDir)) {
      logger.warn('[Migrations] No prisma/migrations directory found, skipping auto-migrate');
      migrationsRan = true;
      await prisma.$disconnect();
      return;
    }
    const entries = fs.readdirSync(migrationsDir, { withFileTypes: true });
    const migrationFolders = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
    if (migrationFolders.length === 0) {
      migrationsRan = true;
      await prisma.$disconnect();
      return;
    }
    const tableCheck = await prisma.$queryRawUnsafe<
      Array<{ exists: boolean }>
    >(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = '_prisma_migrations'
      ) as exists;
    `).catch(() => [{ exists: false }]);
    const migrationsTableExists = Array.isArray(tableCheck) && tableCheck[0]?.exists === true;

    let applied: Set<string> = new Set();
    if (migrationsTableExists) {
      const rows = await prisma.$queryRawUnsafe<
        Array<{ migration_name: string; finished_at: Date | null }>
      >(`
        SELECT "migration_name", "finished_at" FROM public."_prisma_migrations"
        WHERE "rolled_back_at" IS NULL;
      `).catch(() => []);
      applied = new Set(rows.filter((r) => r.finished_at).map((r) => r.migration_name));
    } else {
      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS public."_prisma_migrations" (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          checksum TEXT,
          finished_at TIMESTAMPTZ,
          migration_name TEXT UNIQUE,
          logs TEXT,
          rolled_back_at TIMESTAMPTZ,
          started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          applied_steps_count INTEGER NOT NULL DEFAULT 0
        );
      `).catch(() => null);
    }

    for (const folder of migrationFolders) {
      if (applied.has(folder)) continue;
      const sqlFile = path.join(migrationsDir, folder, 'migration.sql');
      if (!fs.existsSync(sqlFile)) continue;
      const sql = fs.readFileSync(sqlFile, 'utf8').trim();
      if (!sql) continue;
      try {
        const started = new Date();
        await prisma.$executeRawUnsafe(sql);
        await prisma.$executeRawUnsafe(
          `
            INSERT INTO public."_prisma_migrations"
              ("migration_name", "started_at", "finished_at", "applied_steps_count", "checksum")
            VALUES ($1, $2, $3, 1, 'auto')
            ON CONFLICT ("migration_name") DO NOTHING;
          `,
          folder,
          started,
          new Date(),
        ).catch(() => null);
        logger.info('[Migrations] Applied on production boot', { migration: folder });
      } catch (err: any) {
        logger.warn('[Migrations] Failed to apply (continuing boot)', {
          migration: folder,
          message: err?.message,
        });
      }
    }

    await prisma.$disconnect();
    migrationsRan = true;
  } catch (err: any) {
    logger.warn('[Migrations] Auto-migrate aborted (continuing boot anyway)', {
      message: err?.message,
    });
    migrationsRan = true;
  }
}

export function createApp(): express.Application {
  const app = express();

  runMigrationsIfNeeded().catch((err) => {
    logger.warn('[Migrations] Auto-migrate promise rejected silently', {
      message: err?.message,
    });
  });

  app.use(requestIdMiddleware);
  applySecurityMiddlewares(app);

  app.use(httpLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/', (_req, res) => {
    const year = new Date().getFullYear();
    res.type('html').send(`<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="theme-color" content="#0b7a5c" />
<title>Noor API | توثيق API</title>
<style>
:root{--g:#10b981;--g2:#34d399;--gd:#fbbf24;--t:#e6eaf2;--m:#93a0b8}
*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Tahoma,Arial,"Noto Sans Arabic","Arabic Typesetting",sans-serif;color:var(--t);background:radial-gradient(1200px 600px at 20% -10%,#0e3a2e,transparent 60%),radial-gradient(900px 500px at 110% 10%,#1a2a5c,transparent 55%),linear-gradient(180deg,#070a18,#0a0f22)}
main{max-width:920px;margin:0 auto;padding:56px 24px 80px}.b{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:999px;background:rgba(16,185,129,.12);color:var(--g2);font-weight:600;font-size:13px;border:1px solid rgba(16,185,129,.28)}
.d{width:8px;height:8px;border-radius:50%;background:var(--g);box-shadow:0 0 0 4px rgba(16,185,129,.18);animation:p 1.6s infinite}@keyframes p{0%,100%{opacity:1}50%{opacity:.5}}
h1{font-size:44px;line-height:1.15;margin:18px 0 10px;background:linear-gradient(90deg,#fff,#86efac 40%,#fde68a 100%);-webkit-background-clip:text;background-clip:text;color:transparent}
.l{font-size:18px;color:var(--m);margin:0 0 28px}.g{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin:28px 0 36px}
.c{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.01));border:1px solid rgba(255,255,255,.08);border-radius:20px;padding:22px;transition:.25s ease}.c:hover{transform:translateY(-3px);border-color:rgba(16,185,129,.45)}
.c h3{margin:0 0 6px;font-size:18px;color:#fff}.c p{margin:0 0 14px;color:var(--m);font-size:14.5px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;text-decoration:none;padding:11px 16px;border-radius:12px;font-weight:700;transition:.2s ease;border:1px solid transparent}
.btn.p{background:linear-gradient(180deg,var(--g),#059669);color:#052e22}.btn.p:hover{filter:brightness(1.05)}
.btn.o{background:transparent;border-color:rgba(255,255,255,.12);color:var(--t)}.btn.o:hover{background:rgba(255,255,255,.04)}
.s{display:flex;align-items:center;gap:10px;font-size:14px;color:var(--m);margin-top:8px;flex-wrap:wrap}
.pi{display:inline-block;padding:3px 10px;border-radius:999px;background:rgba(251,191,36,.12);color:var(--gd);font-size:12px;border:1px solid rgba(251,191,36,.3)}
footer{margin-top:32px;color:var(--m);font-size:13px;opacity:.85}
code{font-family:ui-monospace,SFMono-Regular,Consolas,monospace;background:rgba(255,255,255,.06);padding:2px 6px;border-radius:6px;font-size:13px;color:#c7d2fe}
@media (max-width:520px){h1{font-size:32px}}
</style>
</head>
<body>
<main>
  <span class="b"><span class="d"></span> الخدمة تعمل — API Online</span>
  <h1>Noor API ✨<br/>واجهة برمجة تطبيقات نور</h1>
  <p class="l">نسخة <b>v1.0.0</b> — القرآن الكريم · الأحاديث النبوية · مواقيت الصلاة · رحلة إسلامية يومية كاملة لتطبيق Flutter.</p>
  <div class="g">
    <div class="c">
      <span class="pi">Swagger / OpenAPI</span>
      <h3>📚 التوثيق التفاعلي</h3>
      <p>جرب جميع الـ endpoints مباشرة من المتصفح مع وصف عربي لكل طلب واستجابة.</p>
      <a class="btn p" href="/api/v1/docs">افتح التوثيق ↗</a>
    </div>
    <div class="c">
      <span class="pi">Monitoring</span>
      <h3>🩺 فحص صحة الخدمة</h3>
      <p>تأكد من أن قاعدة البيانات والخدمة تعمل بشكل سليم (Health Check).</p>
      <a class="btn o" href="/api/v1/health">/api/v1/health ↗</a>
    </div>
    <div class="c">
      <span class="pi">Discover</span>
      <h3>🧭 روابط سريعة للمطورين</h3>
      <p>أشهر الـ endpoints التي يحتاجها فريق Flutter للبدء فوراً.</p>
      <div style="display:flex;flex-wrap:wrap;gap:8px">
        <code>/quran/surahs</code><code>/content/verse-of-day</code><code>/prayers/today</code><code>/journey/today</code>
      </div>
    </div>
  </div>
  <div class="s"><span>Base URL للاستخدام في تطبيق Flutter:</span><code>https://noor-app-backend-one.vercel.app/api/v1</code></div>
  <footer>© ${year} Noor App — Express · TypeScript · Prisma · Neon PostgreSQL · Vercel</footer>
</main>
</body>
</html>`);
  });

  setupSwagger(app);

  app.use(appConfig.apiPrefix, apiRateLimiter, v1Router);

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
