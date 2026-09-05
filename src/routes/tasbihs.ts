import { Router } from 'express';
import { listTasbihsHandler } from '../controllers/tasbih.controller';

/**
 * Public catalog of authentic tasbih / counter adhkar for the Flutter picker.
 * Mounted at /api/v1/tasbihs (plural) — separate from /api/v1/tasbih/* session APIs.
 */
export const tasbihsRouter = Router();

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
