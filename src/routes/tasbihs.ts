import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../middleware/auth';
import { validate } from '../lib/validation';
import {
  listTasbihsHandler,
  addUserTasbihHandler,
  removeUserTasbihHandler,
} from '../controllers/tasbih.controller';

/**
 * Catalog + personal custom tasbih list.
 * Mounted at /api/v1/tasbihs (plural) — separate from /api/v1/tasbih/* session APIs.
 */
export const tasbihsRouter = Router();

const addUserTasbihSchema = z.object({
  text: z.string().trim().min(1).max(500),
  count: z.number().int().min(1).max(100_000).nullable().optional(),
});

const tasbihIdParamsSchema = z.object({
  id: z.string().uuid(),
});

/**
 * @openapi
 * /tasbihs:
 *   get:
 *     tags: ['Tasbih']
 *     summary: Catalog of authentic tasbih / repeatable adhkar
 *     description: |
 *       Ordered list for the "اختر الذكر" picker. Each item has `id`, `order`, `text`, `count`.
 *       `count` is an authentic fixed repetition when one exists (e.g. 33 after salah); otherwise null.
 *       `id` values match PATCH /tasbih/change-dhikr.
 *     responses:
 *       200:
 *         description: Catalog retrieved
 */
tasbihsRouter.get('/', listTasbihsHandler);

/**
 * @openapi
 * /tasbihs:
 *   post:
 *     tags: ['Tasbih']
 *     summary: Add a custom tasbih to the logged-in user's personal list
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [text]
 *             properties:
 *               text: { type: string, maxLength: 500 }
 *               count: { type: integer, nullable: true, minimum: 1 }
 *     responses:
 *       201:
 *         description: Custom tasbih created
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Duplicate text for this user
 */
tasbihsRouter.post('/', authenticate, validate(addUserTasbihSchema), addUserTasbihHandler);

/**
 * @openapi
 * /tasbihs/{id}:
 *   delete:
 *     tags: ['Tasbih']
 *     summary: Remove a custom tasbih from the logged-in user's personal list
 *     security: [ { bearerAuth: [] } ]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Removed
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Not found (or not owned by this user)
 */
tasbihsRouter.delete(
  '/:id',
  authenticate,
  validate(tasbihIdParamsSchema, 'params'),
  removeUserTasbihHandler,
);
