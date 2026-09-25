import { Router } from 'express';
import { z } from 'zod';
import { optionalAuthenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  answerStanceHandler,
  getNextStanceHandler,
  getStanceByIdHandler,
  getTodayStanceHandler,
  listStancesHandler,
  stanceAnswerBodySchema,
} from '../controllers/stance.controller';

export const stancesRouter = Router();

/**
 * @openapi
 * /stances/today:
 *   get:
 *     tags: [Stances]
 *     summary: موقف اليوم — What's your stance (today)
 *     security: [{ bearerAuth: [] }]
 *     parameters:
 *       - in: query
 *         name: dayOfYear
 *         schema: { type: integer }
 *     responses:
 *       200:
 *         description: Situation card (ruling only if already answered)
 */
stancesRouter.get('/today', optionalAuthenticate, getTodayStanceHandler);

/**
 * @openapi
 * /stances/next:
 *   get:
 *     tags: [Stances]
 *     summary: الموقف التالي (consecutive)
 *     parameters:
 *       - in: query
 *         name: afterId
 *         required: true
 *         schema: { type: string, example: stance_001 }
 */
stancesRouter.get('/next', optionalAuthenticate, getNextStanceHandler);

stancesRouter.get('/catalog', listStancesHandler);

stancesRouter.get('/:id', optionalAuthenticate, getStanceByIdHandler);

const idParamSchema = z.object({
  id: z.string().trim().min(1).max(64),
});

/**
 * @openapi
 * /stances/{id}/answer:
 *   post:
 *     tags: [Stances]
 *     summary: Submit choice → returns الرأي الشرعي والأصح
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [selectedOptionKey]
 *             properties:
 *               selectedOptionKey: { type: string, enum: [A, B, C] }
 */
stancesRouter.post(
  '/:id/answer',
  optionalAuthenticate,
  validate(idParamSchema, 'params'),
  validate(stanceAnswerBodySchema),
  answerStanceHandler,
);
