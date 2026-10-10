import './lib/timezone-corrections';
import express from 'express';

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

// Schema migrations run once during deployment via npm run prisma:deploy.
// Never split/replay migration SQL or mark failed statements as applied during API boot.

export function createApp(): express.Application {
  const app = express();

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
