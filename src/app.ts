import express from 'express';

import { appConfig } from './config';
import { errorHandler, notFoundHandler, requestIdMiddleware } from './middleware/common';
import { connectDatabase } from './lib/prisma';
import { httpLogger, applySecurityMiddlewares, apiRateLimiter } from './middleware/http';
import { setupSwagger } from './lib/swagger';
import { v1Router } from './routes';

const API_VERSION = '1.0.0';

function isBrowserRequest(req: express.Request): boolean {
  const accept = req.headers.accept ?? '';
  const ua = req.headers['user-agent'] ?? '';
  return (
    accept.includes('text/html') &&
    !accept.includes('application/json') &&
    !ua.includes('Dart') &&
    !ua.includes('PostmanRuntime') &&
    !ua.includes('curl') &&
    !ua.includes('httpie') &&
    !ua.includes('Go-http-client') &&
    !ua.includes('python-requests') &&
    !ua.includes('Java/') &&
    !ua.includes('okhttp') &&
    !ua.includes('axios')
  );
}

export function createApp(): express.Application {
  const app = express();

  app.use(requestIdMiddleware);
  applySecurityMiddlewares(app);

  app.use(httpLogger);
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  app.get('/', (req, res) => {
    const base = `${req.protocol}://${req.get('host') ?? ''}`;
    const p = appConfig.apiPrefix;

    if (isBrowserRequest(req)) {
      res.redirect(302, `${p}/docs`);
      return;
    }

    res.json({
      success: true,
      message: 'Welcome to Noor API — Islamic Lifestyle REST API',
      data: {
        name: 'Noor API',
        tagline: 'Quran · Hadith · Prayers · Daily Islamic Journey',
        version: API_VERSION,
        environment: appConfig.nodeEnv,
        language: 'Arabic-first (العربية)',
        author: 'Noor App Team',
        docs: {
          swagger_ui: `${base}${p}/docs`,
          health: `${base}${p}/health`,
          openapi_json: `${base}${p}/openapi.json`,
        },
        endpoints: {
          auth: {
            register: `POST ${base}${p}/auth/signup`,
            login: `POST ${base}${p}/auth/login`,
            me: `GET ${base}${p}/auth/me`,
          },
          quran: {
            list_surahs: `GET ${base}${p}/quran/surahs`,
            surah_ayahs: `GET ${base}${p}/quran/surahs/:id/ayahs`,
          },
          content: {
            verse_of_day: `GET ${base}${p}/content/verse-of-day`,
            hadith_of_day: `GET ${base}${p}/content/hadith-of-day`,
            daily_challenge: `GET ${base}${p}/content/daily-challenge`,
          },
          prayers: {
            today_prayers_today: `GET ${base}${p}/prayers/today`,
            prayers_schedule: `GET ${base}${p}/prayers/schedule`,
          },
          journey: {
            today: `GET ${base}${p}/journey/today`,
            progress: `GET ${base}${p}/journey/progress`,
          },
          challenges: `GET ${base}${p}/challenges`,
          dashboard: `GET ${base}${p}/dashboard`,
          notifications: `GET ${base}${p}/notifications`,
        },
        available_modules: [
          'auth (53 fully-seeded Quran (114 Surahs, 6236 Ayahs)',
          'Daily Content (Verse · Hadith · Challenge)',
          'Prayer Times (global calculation methods)',
          'Daily Journey Tracking',
          'Gamified Challenges & Points',
          'Notifications',
        ],
        database: 'Neon PostgreSQL (Serverless)',
        hosting: 'Vercel Serverless Functions',
        timestamp: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
    });
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
