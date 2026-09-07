import { Router } from 'express';
import {
  getAudioDefaultsHandler,
  listAzanSoundsHandler,
  listNotificationSoundsHandler,
  streamAzanMediaHandler,
} from '../controllers/azan-audio.controller';

/**
 * Public Azan / prayer-notification audio catalogs + self-hosted media.
 * Separate from Quran audio (`/quran/audio`, Quran Foundation).
 */
export const azanRouter = Router();

/**
 * @openapi
 * /azan/sounds:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: List available Azan (Adhan) audio options
 *     description: Public catalog. Full Azan audio URLs (self-hosted, license-cleared).
 *     responses:
 *       200:
 *         description: Azan sound list
 */
azanRouter.get('/sounds', listAzanSoundsHandler);

/**
 * @openapi
 * /azan/notification-sounds:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: List prayer notification / pre-reminder sound options
 *     description: Short tones for reminders — not full Azan, not Quran audio.
 *     responses:
 *       200:
 *         description: Notification sound list
 */
azanRouter.get('/notification-sounds', listNotificationSoundsHandler);

/**
 * @openapi
 * /azan/audio-defaults:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: Default Azan + notification sound selection (guest-friendly)
 *     responses:
 *       200:
 *         description: Default ids and resolved sound objects
 */
azanRouter.get('/audio-defaults', getAudioDefaultsHandler);

/**
 * @openapi
 * /azan/media/{file}:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: Stream a self-hosted license-cleared Azan or notification audio file
 *     parameters:
 *       - in: path
 *         name: file
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Audio bytes
 *       206:
 *         description: Partial content (Range)
 *       404:
 *         description: Unknown file
 */
azanRouter.get('/media/:file', streamAzanMediaHandler);
