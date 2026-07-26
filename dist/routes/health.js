"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRouter = void 0;
const express_1 = require("express");
const common_1 = require("../middleware/common");
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
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
exports.healthRouter = (0, express_1.Router)();
exports.healthRouter.get('/', (0, common_1.asyncHandler)(async (req, res) => {
    let databaseStatus;
    try {
        await prisma_1.prisma.$queryRaw `SELECT 1`;
        databaseStatus = 'connected';
    }
    catch {
        databaseStatus = 'disconnected';
    }
    const isHealthy = databaseStatus === 'connected';
    (0, common_1.sendSuccess)(res, {
        status: isHealthy ? 'ok' : 'degraded',
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        environment: config_1.appConfig.nodeEnv,
        database: databaseStatus,
        requestId: req.requestId,
    }, 'Service health check completed', isHealthy ? config_1.HttpStatus.OK : config_1.HttpStatus.SERVICE_UNAVAILABLE);
}));
//# sourceMappingURL=health.js.map