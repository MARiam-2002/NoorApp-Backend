import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAIEnabled } from '../middleware/ai';
import { validate } from '../lib/validation';
import {
  getAIStatusHandler,
  quranDiscoveryHandler,
  quranDiscoverySchema,
} from '../controllers/ai.controller';

export const aiRouter = Router();

aiRouter.use(requireAIEnabled, authenticate);

/**
 * @openapi
 * /ai/status:
 *   get:
 *     tags: ['AI']
 *     summary: حالة مساعد نور الذكي (Noor AI)
 *     description: |
 *       تُرجع حالة ميزة الذكاء الاصطناعي بدون أي أسرار (لا مفاتيح ولا أسماء نماذج).
 *
 *       - عندما تكون الميزة مغلقة على الخادم (`AI_ENABLED=false`، الوضع الافتراضي) تُرجع **503** بالكود `AI_DISABLED` لأي طلب، مع أو بدون توكن.
 *       - عندما تكون مفعّلة يلزم توكن صالح، وتُرجع `enabled` و`provider` و`configured` والحدود المسموحة.
 *
 *       ملاحظة Flutter: اعرض مدخل المساعد فقط عند `success: true` و`data.enabled: true` و`data.features.chat: true`.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: الميزة مفعّلة على الخادم
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         enabled: { type: boolean, example: true }
 *                         provider: { type: string, example: openai }
 *                         configured: { type: boolean, example: false }
 *                         features:
 *                           type: object
 *                           properties:
 *                             chat: { type: boolean, example: false }
 *                             streaming: { type: boolean, example: false }
 *                             quranDiscovery: { type: boolean, example: true }
 *                             conversations: { type: boolean, example: false }
 *                         limits:
 *                           type: object
 *                           properties:
 *                             maxMessageLength: { type: integer, example: 1500 }
 *                             dailyMessageLimit: { type: integer, example: 20 }
 *                             maxStreamSeconds: { type: integer, example: 120 }
 *             example:
 *               success: true
 *               message: Noor AI status retrieved successfully
 *               data:
 *                 enabled: true
 *                 provider: openai
 *                 configured: false
 *                 features: { chat: false, streaming: false, quranDiscovery: true, conversations: false }
 *                 limits: { maxMessageLength: 1500, dailyMessageLimit: 20, maxStreamSeconds: 120 }
 *               meta: {}
 *               timestamp: '2026-09-28T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       503:
 *         description: الميزة مغلقة على الخادم (الوضع الافتراضي)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Noor AI is not available yet
 *               code: AI_DISABLED
 *               blame: FEATURE_DISABLED
 *               nextCheck: Feature is switched off on the server; hide its entry point in the app.
 *               timestamp: '2026-09-28T10:30:00.000Z'
 *               requestId: 3f1c2a9e-0000-4000-8000-000000000000
 */
aiRouter.get('/status', getAIStatusHandler);

/**
 * @openapi
 * /ai/quran-discovery:
 *   post:
 *     tags: ['AI']
 *     summary: اكتشاف الآيات — مرجع دقيق أو بحث نصي حتمي (بدون ذكاء اصطناعي توليدي)
 *     description: |
 *       - **exact**: إذا كان النص مرجعاً قرآنياً (`البقرة 255`، `2:255-257`، `Al-Baqarah 255`) تُرجع الآيات المطلوبة كاملة من جدول الآيات (حتى 50 آية، و`limit` لا يطبّق)، و`score` = 1.
 *       - **search**: غير ذلك يتم بحث نصي حتمي على نسخة مُطبّعة من النص العثماني (بدون LLM أو embeddings)، و`score` بين 0 و1 (1 = تطابق الكلمة).
 *       - `text` هو نص الآية المعتمد نفسه الذي ترجعه نقاط القرآن الحالية (بدون البسملة الملحقة بأول السورة).
 *       - المرجع غير الصالح (سورة غير معروفة، آية خارج السورة، مدى معكوس أو أكبر من 50) → 400 `VALIDATION_ERROR` مع `details.reason`.
 *       - مغلقة افتراضياً: `503 AI_DISABLED` عندما `AI_ENABLED=false`.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [query]
 *             properties:
 *               query: { type: string, minLength: 1, maxLength: 200, example: 'البقرة 255' }
 *               limit: { type: integer, minimum: 1, maximum: 50, default: 10 }
 *     responses:
 *       200:
 *         description: نتائج الاكتشاف
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         mode: { type: string, enum: [exact, search] }
 *                         results:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               surahId: { type: integer, example: 2 }
 *                               ayahNumber: { type: integer, example: 255 }
 *                               surahNameAr: { type: string, example: البقرة }
 *                               text: { type: string }
 *                               page: { type: integer, nullable: true, example: 42 }
 *                               juz: { type: integer, nullable: true, example: 3 }
 *                               score: { type: number, example: 1 }
 *       400:
 *         description: طلب غير صالح أو مرجع قرآني غير موجود
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               message: Surah 2 has 286 ayahs; ayah 999 does not exist
 *               code: VALIDATION_ERROR
 *               details: { reason: AYAH_OUT_OF_RANGE }
 *               timestamp: '2026-09-28T10:30:00.000Z'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       503:
 *         description: الميزة مغلقة على الخادم (الوضع الافتراضي) — `AI_DISABLED`
 */
aiRouter.post('/quran-discovery', validate(quranDiscoverySchema, 'body'), quranDiscoveryHandler);
