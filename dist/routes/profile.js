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
exports.profileRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const validator_1 = require("../shared/utils/validator");
const profileController = __importStar(require("../controllers/profile.controller"));
const updateProfileSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .trim()
        .min(3, 'Username must be at least 3 characters')
        .max(100, 'Username must be at most 100 characters'),
    email: zod_1.z.string().trim().email('Invalid email format').optional(),
});
const changePasswordSchema = zod_1.z.object({
    currentPassword: zod_1.z.string().min(1, 'Current password is required'),
    newPassword: zod_1.z
        .string()
        .min(6, 'New password must be at least 6 characters')
        .max(128, 'New password must be at most 128 characters'),
});
const updateLocationSchema = zod_1.z.object({
    latitude: zod_1.z.coerce
        .number()
        .min(-90, 'Latitude must be between -90 and 90')
        .max(90, 'Latitude must be between -90 and 90'),
    longitude: zod_1.z.coerce
        .number()
        .min(-180, 'Longitude must be between -180 and 180')
        .max(180, 'Longitude must be between -180 and 180'),
    timezone: zod_1.z.string().trim().min(1, 'Timezone must be a non-empty string').optional(),
});
/**
 * @openapi
 * /profile/me:
 *   get:
 *     tags: ['Profile']
 *     summary: جلب بيانات الملف الشخصي
 *     description: |
 *       شاشة الحساب الشخصي. تقوم بإرجاع كافة بيانات المستخدم الأساسية:
 *       اسم المستخدم، صورة الملف الشخصي، البريد الإلكتروني، رقم الجوال، الموقع الجغرافي المحفوظ (خطوط العرض والطول)، المدينة، طريقة حساب أوقات الصلاة، تاريخ الانضمام، وغيرها من البيانات.
 *
 *       تستخدم البيانات المرجعة في الواجهات التالية:
 *       - شاشة الملف الشخصي
 *       - رسالة الترحيب في الشاشة الرئيسية
 *       - صورة المستخدم في شريط التنقل الجانبي أو العلوي
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: بيانات الملف الشخصي
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
/**
 * @openapi
 * /profile/update:
 *   patch:
 *     tags: ['Profile']
 *     summary: تعديل بيانات الملف الشخصي
 *     description: |
 *       تعديل البيانات الأساسية للملف الشخصي مثل الاسم، الصورة، المدينة، طريقة حساب أوقات الصلاة وغيرها.
 *       يقبل البيانات جزئياً، أي يمكن إرسال الحقول المطلوب تعديلها فقط دون الحاجة لإرسال البيانات كاملة.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateProfileRequest'
 *     responses:
 *       200:
 *         description: تم تعديل البيانات بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
/**
 * @openapi
 * /profile/change-password:
 *   patch:
 *     tags: ['Profile']
 *     summary: تغيير كلمة المرور
 *     description: |
 *       تقوم بتغيير كلمة المرور من شاشة الإعدادات. يتطلب إرسال كلمة المرور الحالية كإجراء أمني، بالإضافة لكلمة المرور الجديدة وتأكيدها.
 *       ملاحظة - في حالة تسجيل الدخول عبر Google دون وجود كلمة مرور، تقوم نقطة الوصول هذه بإرجاع خطأ وتنصح باستخدام نقطة استعادة كلمة المرور.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ChangePasswordRequest'
 *     responses:
 *       200:
 *         description: تم تغيير كلمة المرور بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: boolean
 *                       example: true
 *       400:
 *         description: كلمة المرور الحالية غير صحيحة أو الجديدة لا تستوفي الشروط الأمنية
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
/**
 * @openapi
 * /profile/location:
 *   put:
 *     tags: ['Profile']
 *     summary: تحديث الموقع الجغرافي (خطوط العرض والطول والمدينة والدولة)
 *     description: |
 *       تقوم بحفظ الموقع الجغرافي المستخدم في:
 *       - حساب أوقات الصلاة الصحيحة بناءً على الموقع
 *       - شاشة القبلة (من خلال نقطة /qibla/my)
 *       - عرض اسم المدينة في الشاشة الرئيسية
 *
 *       تستخدم عادة بعد أول تشغيل للتطبيق عند طلب صلاحية الوصول إلى الموقع، أو عند تغيير المدينة من شاشة الإعدادات.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateLocationRequest'
 *     responses:
 *       200:
 *         description: تم حفظ الموقع الجغرافي بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
exports.profileRouter = (0, express_1.Router)();
exports.profileRouter.get('/me', auth_1.authenticate, profileController.getProfile);
exports.profileRouter.patch('/update', auth_1.authenticate, (0, validator_1.validate)(updateProfileSchema), profileController.updateProfile);
exports.profileRouter.patch('/change-password', auth_1.authenticate, (0, validator_1.validate)(changePasswordSchema), profileController.changePassword);
exports.profileRouter.put('/location', auth_1.authenticate, (0, validator_1.validate)(updateLocationSchema), profileController.updateLocation);
//# sourceMappingURL=profile.js.map