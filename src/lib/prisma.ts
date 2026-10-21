import { PrismaClient } from '@prisma/client';
import { appConfig, env } from '../config';
import { assertSafeDatabaseTarget } from './database-safety';
import { logger } from './logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const base = new PrismaClient({
    log: appConfig.isDevelopment
      ? [
          { emit: 'event', level: 'query' },
          { emit: 'stdout', level: 'error' },
          { emit: 'stdout', level: 'warn' },
        ]
      : [{ emit: 'stdout', level: 'error' }],
  });
  return base.$extends({ query: {
    async $allOperations({ args, query }) {
      assertSafeDatabaseTarget(env.DATABASE_URL, env.NODE_ENV);
      return query(args);
    },
  } }) as unknown as PrismaClient;
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (!appConfig.isProduction) {
  globalThis.__prisma = prisma;
}

export async function connectDatabase(): Promise<void> {
  try {
    assertSafeDatabaseTarget(env.DATABASE_URL, env.NODE_ENV);
    await prisma.$connect();
    logger.info('Database connected successfully');
  } catch (error) {
    logger.error('Failed to connect to database', { error });
    throw error;
  }
}

export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Database disconnected');
}
