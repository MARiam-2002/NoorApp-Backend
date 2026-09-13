import './load-env';

import type { Server } from 'node:http';

import { appConfig, getApiBasePath } from './config';
import { initializeApp } from './app';
import { logger } from './lib/logger';
import { disconnectDatabase } from './lib/prisma';

async function bootstrap(): Promise<void> {
  const app = await initializeApp();

  const server: Server = app.listen(appConfig.port, appConfig.host, () => {
    logger.info(`Noor API running on ${appConfig.host}:${appConfig.port}`, {
      environment: appConfig.nodeEnv,
      apiBasePath: getApiBasePath(),
      docs: `${getApiBasePath()}/docs`,
    });
  });

  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      void disconnectDatabase()
        .catch((error: unknown) => {
          logger.error('Error disconnecting database during shutdown', { error });
        })
        .finally(() => {
          logger.info('Server closed');
          process.exit(0);
        });
    });
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', {
      reason: reason instanceof Error ? reason.message : String(reason),
    });
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception', {
      message: error.message,
      stack: error.stack,
    });
    shutdown('uncaughtException');
  });
}

bootstrap().catch((error: unknown) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
