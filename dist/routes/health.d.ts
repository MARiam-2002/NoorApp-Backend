/**
 * @openapi
 * /health:
 *   get:
 *     tags: ['Health']
 *     summary: فحص حالة الخدمة وقاعدة البيانات
 *     description: |
 *       تقوم بإرجاع حالة الخدمة العامة وصلاحية الاتصال بقاعدة البيانات PostgreSQL.
 *
 *       تُستخدم من قبل فرق التطوير وأنظمة المراقبة لضمان عمل الخادم وقاعدة البيانات. إذا كانت قيمة الحالة تساوي ok وقيمة قاعدة البيانات تساوي connected فهذا يعني أن الخدمة تعمل بشكل صحيح.
 *     responses:
 *       200:
 *         description: حالة الخدمة سليمة
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
 *                         status:
 *                           type: string
 *                           enum: [ok, degraded]
 *                           example: "ok"
 *                         uptime:
 *                           type: number
 *                           example: 1234.56
 *                         timestamp:
 *                           type: string
 *                           format: date-time
 *                         environment:
 *                           type: string
 *                           example: "production"
 *                         database:
 *                           type: string
 *                           enum: [connected, disconnected]
 *                         requestId:
 *                           type: string
 *                           nullable: true
 *       503:
 *         description: الخدمة متعطلة أو غير قادرة على الاتصال بقاعدة البيانات
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
 *                         status:
 *                           type: string
 *                           example: "degraded"
 *                         database:
 *                           type: string
 *                           example: "disconnected"
 */
export declare const healthRouter: import("express-serve-static-core").Router;
//# sourceMappingURL=health.d.ts.map