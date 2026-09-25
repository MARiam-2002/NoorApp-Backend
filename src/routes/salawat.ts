import { Router } from 'express';
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
