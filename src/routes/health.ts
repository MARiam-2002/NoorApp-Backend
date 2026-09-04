import { Router } from 'express';

import { asyncHandler } from '../middleware/common';
import { sendSuccess } from '../shared/utils/response';
import { prisma } from '../lib/prisma';
import { appConfig, HttpStatus } from '../config';
import { getEmailProviderStatus } from '../lib/email';
import { hasQuranFoundationCredentials } from '../lib/quran-foundation';

type HealthData = {
  status: 'ok' | 'degraded';
  uptime: number;
  timestamp: string;
  environment: string;
  database: 'connected' | 'disconnected';
  /** Password-reset mail readiness (no secrets). */
  email: {
    configured: boolean;
    provider: string;
    readyForDelivery: boolean;
  };
  quranFoundation: {
    oauthConfigured: boolean;
  };
  requestId?: string;
};

/**
 * @openapi
 * /health:
 *   get:
 *     tags: ['Health']
 *     summary: فحص حالة الخدمة وقاعدة البيانات
 *     description: |
 *       تقوم بإرجاع حالة الخدمة العامة وصلاحية الاتصال بقاعدة البيانات PostgreSQL.
 *
 *       تُستخدم من قبل فرق التطوير وأنظمة المراقبة لضمان عمل الخادم وقاعدة البيانات. إذا كانت قيمة الحالة تساوي ok وقيمة قاعدة البيانات تساوي connected فهذا يعني أن الخدمة تعمل بشكل صحيح.
 *     responses:
 *       200:
 *         description: حالة الخدمة سليمة
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [ok, degraded]
 *                           example: "ok"
 *                         uptime:
 *                           type: number
 *                           example: 1234.56
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         environment:
 *                           type: string
 *                           example: "production"
 *                         database:
 *                           type: string
 *                           enum: [connected, disconnected]
 *                         requestId:
 *                           type: string
 *                           nullable: true
 *       503:
 *         description: الخدمة متعطلة أو غير قادرة على الاتصال بقاعدة البيانات
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           example: "degraded"
 *                         database:
 *                           type: string
 *                           example: "disconnected"
 */
export const healthRouter = Router();

healthRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    let databaseStatus: HealthData['database'];

    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch {
      databaseStatus = 'disconnected';
    }

    const isHealthy = databaseStatus === 'connected';
    const mail = getEmailProviderStatus();
    const emailConfigured =
      mail.provider !== 'mock' && mail.hasMailFrom && (mail.hasResendKey || mail.hasSmtpAuth);
    // Test Resend sender can only deliver to the Resend account owner — not production-ready.
    const readyForDelivery = emailConfigured && !mail.usesResendTestSender;

    sendSuccess(
      res,
      {
        status: isHealthy ? 'ok' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: appConfig.nodeEnv,
        database: databaseStatus,
        email: {
          configured: emailConfigured,
          provider: mail.provider,
          readyForDelivery,
        },
        quranFoundation: {
          oauthConfigured: hasQuranFoundationCredentials(),
        },
        requestId: req.requestId,
      } satisfies HealthData,
      'Service health check completed',
      req,
      isHealthy ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE,
    );
  }),
);
