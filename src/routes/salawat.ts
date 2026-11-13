import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../middleware/common';
import { authenticate } from '../middleware/auth';
import { sendSuccess } from '../shared/utils/response';
import { addSalawatCount, getSalawatWeeklyMine, getSalawatWeeklyPublic } from '../services/salawat-weekly.service';
import {
  listSalawatAudioHandler,
  streamSalawatMediaHandler,
} from '../controllers/salawat.controller';

/**
 * Public Salawat / Prayer Upon the Prophet ﷺ audio catalog.
 * Preference sync remains GET/PATCH/PUT /profile/salawat-preferences.
 */
export const salawatRouter = Router();

/**
 * @openapi
 * /salawat/audio:
 *   get:
 *     tags: ['Salawat Audio']
 *     summary: List Pray-for-the-Prophet ﷺ sound catalog (picker)
 *     description: |
 *       Public catalog. No auth.
 *       One shared voice: `salli_ala_muhammad_voice` → `assets/salawat/salli_ala_muhammad.mp3`.
 *       Preview via `audioUrl`. Save id with PATCH /profile/salawat-preferences.
 *     responses:
 *       200:
 *         description: Catalog with clips[], defaultId, counts
 */
salawatRouter.get('/audio', listSalawatAudioHandler);

/**
 * @openapi
 * /salawat/media/{file}:
 *   get:
 *     tags: ['Salawat Audio']
 *     summary: Stream a hosted Salawat / reminder MP3
 *     description: Hosted Salawat voice MP3 (`salli_ala_muhammad.mp3`).
 *     parameters:
 *       - in: path
 *         name: file
 *         required: true
 *         schema:
 *           type: string
 *           example: salli_ala_muhammad.mp3
 *     responses:
 *       200:
 *         description: Audio bytes (audio/mpeg)
 *       206:
 *         description: Partial content (Range)
 *       404:
 *         description: Unknown file
 */
salawatRouter.get('/media/:file', streamSalawatMediaHandler);

// ---------------------------------------------------------------- weekly gathering (Thursday Maghrib → Friday Maghrib)

/** Public: window for a timezone + this week's shared total. */
salawatRouter.get('/weekly', asyncHandler(async (req, res) => {
  const q = z.object({ timezone: z.string().max(64).optional() }).strict().parse(req.query);
  res.setHeader('Cache-Control', 'public, max-age=30');
  sendSuccess(res, await getSalawatWeeklyPublic(q.timezone), 'Weekly salawat gathering', req);
}));
/** Signed in: window from the profile location, my count, last weeks. */
salawatRouter.get('/weekly/me', authenticate, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await getSalawatWeeklyMine(req.user!.sub), 'My weekly salawat', req);
}));
/** Signed in: add a counted batch { batchId (uuid), count 1..1000 } while the gathering is open (409 otherwise). */
salawatRouter.post('/weekly/count', authenticate, asyncHandler(async (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  sendSuccess(res, await addSalawatCount(req.user!.sub, req.body), 'Salawat counted', req);
}));
