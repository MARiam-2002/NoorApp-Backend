import { Router } from 'express';
import type { RequestHandler } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  getAyahHandler,
  getAyahHistoryHandler,
} from '../controllers/ayah.controller';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';

const ayahCurrentHeaderSchema = z.object({
  'x-noor-app-open-id': z
    .string({
      message:
        'Missing required header X-Noor-App-Open-Id: send a new uuid RFC-4122 v4 once per real Flutter app open / cold start',
    })
    .uuid({ message: 'X-Noor-App-Open-Id must be a valid uuid RFC-4122' }),
});

// Custom middleware to validate headers
const validateAyahHeaders: RequestHandler = (req, _res, next) => {
  const result = ayahCurrentHeaderSchema.safeParse({
    'x-noor-app-open-id': req.headers['x-noor-app-open-id'],
  });

  if (!result.success) {
    const firstError = result.error.issues[0];
    throw new AppError(
      firstError?.message || 'Invalid X-Noor-App-Open-Id header',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
      { errors: result.error.issues }
    );
  }

  next();
};

const ayahHistoryQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20).optional(),
});

export const ayahRouter = Router();
// Railway deployment verification: 2026-09-17

/**
 * @openapi
 * /ayah:
 *   get:
 *     tags: ['Ayah']
 *     summary: Ayah of the current Flutter app open (Home / Lock Screen / Widget)
 *     description: |
 *       Returns one Quran Ayah for the current Flutter app open/session.
 *       Flutter MUST send `X-Noor-App-Open-Id: <uuid>` = a new RFC-4122 uuid
 *       generated exactly once per real cold app open (process start) and reused for
 *       every `GET /ayah` call, retry, Home rebuild, and widget build within that open.
 *       Backend uses the header as part of UNIQUE(userId, sessionId) so:
 *       - Same X-Noor-App-Open-Id (same open) → always returns the identical Ayah +
 *         always creates ZERO duplicate history rows beyond the first call of the session.
 *       - Different X-Noor-App-Open-Id (next real open) → new Ayah can be selected +
 *         previous session Ayah remains permanently visible in GET /ayah/history.
 *       The returned payload is fully linked to the existing Quran reader via surahId,
 *       ayahNumber, page, juz.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: header
 *         name: X-Noor-App-Open-Id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: >
 *           RFC-4122 v4 uuid created by Flutter exactly once per cold app open and reused
 *           across every Home/widget/retry call in that process lifetime.
 *     responses:
 *       200:
 *         description: Ayah for the current app open (stable for the whole session)
 *       400:
 *         description: Missing or invalid X-Noor-App-Open-Id header (400 VALIDATION_ERROR)
 *       401:
 *         description: Unauthenticated (missing/invalid Bearer token)
 *       404:
 *         description: Referenced Ayah missing from the Quran source of truth (should not happen on seeded DB)
 */
ayahRouter.get(
  '/',
  authenticate,
  validateAyahHeaders,
  getAyahHandler,
);

/**
 * @openapi
 * /ayah/history:
 *   get:
 *     tags: ['Ayah']
 *     summary: Ayah display history across previous app opens (newest-first, paginated)
 *     description: |
 *       All Ayahs previously shown to this user in prior (and current) app opens,
 *       ordered from the most recent open at the top (ORDER BY createdAt DESC).
 *       Pagination supported via `page` (default 1) and `limit` (default 20, max 100).
 *       Each history item embeds the full canonical Quran identifiers (surahId,
 *       ayahNumber, page, juz, resolved Surah names, sanitized Arabic text) so Flutter
 *       can open the existing Quran reader directly from the history row.
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1, minimum: 1 }
 *         description: Page number (default 1)
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20, minimum: 1, maximum: 100 }
 *         description: Items per page (default 20, hard-capped at 100 server-side)
 *     responses:
 *       200:
 *         description: Paginated Ayah history (newest-first, with standard meta block)
 *       400:
 *         description: Invalid pagination params (400 VALIDATION_ERROR)
 *       401:
 *         description: Unauthenticated (missing/invalid Bearer token)
 */
ayahRouter.get(
  '/history',
  authenticate,
  validate(ayahHistoryQuerySchema, 'query'),
  getAyahHistoryHandler,
);
