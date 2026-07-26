"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.dashboardRouter = void 0;
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const dashboardController = __importStar(require("../controllers/dashboard.controller"));
/**
 * @openapi
 * /dashboard:
 *   get:
 *     tags: ['Dashboard']
 *     summary: الشاشة الرئيسية (كل البيانات في طلب واحد)
 *     description: |
 *       الطلب الأهم للـ Flutter - استدعاء واحد فقط عند فتح التطبيق.
 *       يحتوي على:
 *       - التحية + النقاط
 *       - أوقات الصلاة + العداد التنازلي للصلاة القادمة
 *       - آية اليوم
 *       - حديث اليوم
 *       - رحلتك اليومية: الصلاة + القرآن + الذكار + الصدقة
 *       - استكمال الختمة (السورة الحالية + التقدم)
 *       - تحدي اليوم + حالة إنجازه + استلام المكافأة
 *       - أدوات سريعة (المسبحة + القبلة)
 *       للتحديثات الجزئية بعد فعل المستخدم، استخدم endpoints الدقيقة في كل module.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات الشاشة الرئيسية
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/DashboardResponse'
 *       401:
 *         description: ❌ التوكن غير صالح أو منتهي
 */
exports.dashboardRouter = (0, express_1.Router)();
exports.dashboardRouter.get('/', auth_1.authenticate, dashboardController.getDashboard);
//# sourceMappingURL=dashboard.js.map