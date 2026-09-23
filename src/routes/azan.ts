import { Router } from 'express';
import {
  getAudioDefaultsHandler,
  listAzanSoundsHandler,
  listNotificationSoundsHandler,
  streamAzanMediaHandler,
} from '../controllers/azan-audio.controller';
import {
  listCalculationMethodsHandler,
  listMadhabsHandler,
} from '../controllers/azan.controller';

/**
 * Public Azan / prayer-notification audio catalogs + self-hosted media.
 * Separate from Quran audio (`/quran/audio`, Quran Foundation).
 */
export const azanRouter = Router();

/**
 * @openapi
 * /azan/calculation-methods:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: Calculation method dropdown catalog (6 methods, EN/AR)
 *     description: |
 *       Public catalog for building the "Calculation Method" dropdown picker in Azan Settings.
 *       Returns 6 canonical methods (EGYPT, MWL, MAKKAH, KARACHI, ISNA, TEHRAN) sorted by recommended order,
 *       with EN/AR labels, region hints, and EGYPT marked as default=true.
 *       Use the short `id` field as the canonical key when saving preferences and in query params.
 *       Both short ids and legacy long ids (e.g. EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY) are accepted.
 *     responses:
 *       200:
 *         description: Calculation methods catalog
 */
azanRouter.get('/calculation-methods', listCalculationMethodsHandler);

/**
 * @openapi
 * /azan/madhabs:
 *   get:
 *     tags: ['Azan Audio']
 *     summary: Asr Madhab dropdown catalog (SHAFI default, HANAFI)
 *     description: |
 *       Public catalog for building the "Asr Madhab" (مذهب العصر) dropdown picker in Azan Settings.
 *       Returns SHAFI (earlier Asr, default=true) and HANAFI (later Asr).
 *       Use the uppercase `id` field (SHAFI / HANAFI) as the canonical key.
 *     responses:
 *       200:
 *         description: Asr Madhabs catalog
 */
azanRouter.get('/madhabs', listMadhabsHandler);

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
