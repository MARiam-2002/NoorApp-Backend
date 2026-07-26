import './load-env';

import { appConfig, getApiBasePath } from './config';
import { initializeApp } from './app';
import { logger } from './lib/logger';
import { disconnectDatabase } from './lib/prisma';

async function bootstrap(): Promise<void> {
  const app = await initializeApp();

  const server = app.listen(appConfig.port, () => {
    logger.info(`Noor API running on port ${appConfig.port}`, {
      environment: appConfig.nodeEnv,
      apiBasePath: getApiBasePath(),
      docs: `${getApiBasePath()}/docs`,
    });
  });

  const shutdown = (signal: string): void => {
    logger.info(`${signal} received. Shutting down gracefully...`);
    server.close(() => {
      void disconnectDatabase().then(() => {
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
}

bootstrap().catch((error: unknown) => {
  logger.error('Failed to start server', { error });
  process.exit(1);
});
