import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getNawafelTodayHandler,
  markNawafelHandler,
  setNawafelCompletionHandler,
} from '../controllers/nawafel.controller';
import { validate } from '../lib/validation';
import { nawafelCompletionSchema } from '../services/nawafel.service';

export const nawafelRouter = Router();
nawafelRouter.use((_req, res, next) => { res.setHeader('Cache-Control', 'private, no-store'); next(); });
nawafelRouter.put('/:key/completion', authenticate, validate(nawafelCompletionSchema), setNawafelCompletionHandler);

/**
 * @openapi
 * /nawafel/today:
 *   get:
 *     tags: [Nawafel]
 *     summary: Today's sunnah rawatib checklist (12 rak‘ahs / 5 slots)
 *     security: [{ bearerAuth: [] }]
 */
nawafelRouter.get('/today', authenticate, getNawafelTodayHandler);

/**
 * @openapi
 * /nawafel/{key}/mark:
 *   patch:
 *     tags: [Nawafel]
 *     summary: Toggle a rawatib slot for the user's local today
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *           enum: [FAJR_BEFORE_2, DHUHR_BEFORE_4, DHUHR_AFTER_2, MAGHRIB_AFTER_2, ISHA_AFTER_2]
 */
nawafelRouter.patch('/:key/mark', authenticate, markNawafelHandler);
