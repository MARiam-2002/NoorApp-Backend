import { Router } from 'express';
import {
  getAudioDefaultsHandler,
  listAzanSoundsHandler,
  listNotificationSoundsHandler,
} from '../controllers/azan-audio.controller';

/**
 * Public Azan / prayer-notification audio catalogs.
 * Separate from Quran audio (`/quran/audio`, Quran Foundation).
 */
export const azanRouter = Router();

/**
 * @openapi
 * /azan/sounds:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: List available Azan (Adhan) audio options
 *     description: Public catalog. Full Azan MP3 URLs for Flutter to preview and schedule.
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
