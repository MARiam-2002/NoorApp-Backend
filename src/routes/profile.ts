import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { validate } from '../shared/utils/validator';
import * as profileController from '../controllers/profile.controller';

const updateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(100, 'Username must be at most 100 characters'),
  email: z.string().trim().email('Invalid email format').optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(6, 'New password must be at least 6 characters')
    .max(128, 'New password must be at most 128 characters'),
});

const updateLocationSchema = z.object({
  latitude: z.coerce
    .number()
    .min(-90, 'Latitude must be between -90 and 90')
    .max(90, 'Latitude must be between -90 and 90'),
  longitude: z.coerce
    .number()
    .min(-180, 'Longitude must be between -180 and 180')
    .max(180, 'Longitude must be between -180 and 180'),
  timezone: z.string().trim().min(1, 'Timezone must be a non-empty string').optional(),
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
export const profileRouter = Router();

profileRouter.get(
  '/me',
  authenticate,
  profileController.getProfile,
);

profileRouter.patch(
  '/update',
  authenticate,
  validate(updateProfileSchema),
  profileController.updateProfile,
);

profileRouter.patch(
  '/change-password',
  authenticate,
  validate(changePasswordSchema),
  profileController.changePassword,
);

profileRouter.put(
  '/location',
  authenticate,
  validate(updateLocationSchema),
  profileController.updateLocation,
);
