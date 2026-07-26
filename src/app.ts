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

  // Root redirect to documentation
  app.get('/', (_req, res) => {
    res.redirect(`${appConfig.apiPrefix}/docs`);
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
