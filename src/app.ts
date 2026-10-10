import './lib/timezone-corrections';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

import { appConfig, env } from './config';
import { errorHandler, notFoundHandler, requestIdMiddleware, requestDiagnosticsMiddleware } from './middleware/common';
import { connectDatabase } from './lib/prisma';
import { httpLogger, applySecurityMiddlewares, apiRateLimiter } from './middleware/http';
import { setupSwagger } from './lib/swagger';
import { v1Router } from './routes';
import { legalRouter } from './routes/legal';
import { logger } from './lib/logger';
import { warmRedisConnection } from './lib/redis';
import { renderDeveloperLanding } from './shared/utils/developer-landing';

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
        // Split the file into individual statements so that multi-statement
        // migration files (ALTER TABLE, CREATE TABLE, CREATE INDEX, etc.) all
        // execute correctly. $executeRawUnsafe only runs one statement at a time.
        const statements = sql
          .split(/;\s*$/m)          // split on semicolons at end of line
          .map((s) => s.trim())
          .filter((s) => s.length > 0 && !s.startsWith('--'));
        for (const stmt of statements) {
          await prisma.$executeRawUnsafe(stmt + ';').catch((stmtErr: any) => {
            // Log but continue — some statements (like CREATE INDEX IF NOT EXISTS
            // or ADD COLUMN IF NOT EXISTS) may warn but not actually fail.
            logger.warn('[Migrations] Statement warning (non-fatal)', {
              migration: folder,
              stmt: stmt.slice(0, 120),
              message: stmtErr?.message,
            });
          });
        }
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
  app.use(requestDiagnosticsMiddleware);
  applySecurityMiddlewares(app);

  app.use(httpLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/', (_req, res) => {
    const publicOrigin =
      (env.PUBLIC_APP_ORIGIN || '').replace(/\/$/, '') ||
      'https://noorapp-backend-production.up.railway.app';
    res.setHeader('Cache-Control', 'no-store');
    res.type('html').send(renderDeveloperLanding(publicOrigin));
  });
  app.use(legalRouter);

  setupSwagger(app);

  app.use(appConfig.apiPrefix, apiRateLimiter, v1Router);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

/** @deprecated use createApp() — kept for server.ts local bootstrap */
export async function initializeApp(): Promise<express.Application> {
  await connectDatabase();
  await warmRedisConnection().catch((error: unknown) => {
    logger.warn('[Redis] warm-up failed (non-fatal)', {
      message: error instanceof Error ? error.message : String(error),
    });
  });
  return createApp();
}

// Default export - Express app handles all requests
export default createApp;
