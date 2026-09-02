import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import { validate } from '../shared/utils/validator';
import { ianaTimezoneSchema } from '../shared/schemas/validation.schemas';
import * as profileController from '../controllers/profile.controller';

const updateReadingPreferencesSchema = z.object({
  quranFontSize: z.coerce.number().int().min(12).max(60).optional(),
  quranReciter: z.string().trim().min(1).max(100).optional(),
  quranTafsir: z.string().trim().min(1).max(100).optional(),
  quranTranslation: z.string().trim().min(1).max(100).optional(),
});

const updateProfileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters')
    .max(100, 'Username must be at most 100 characters')
    .optional(),
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name must be at most 150 characters')
    .nullable()
    .optional(),
  email: z.string().trim().email('Invalid email format').optional(),
  timezone: ianaTimezoneSchema.optional(),
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
 *             example:
 *               success: true
 *               message: بيانات الملف الشخصي
 *               data:
 *                 id: clx8abc123def456ghi
 *                 username: noor_user
 *                 email: noor@example.com
 *                 fullName: مريم خالد
 *                 avatarUrl: https://cdn.noor.app/avatars/user123.jpg
 *                 phone: +201001234567
 *                 city: القاهرة
 *                 country: Egypt
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 timezone: Africa/Cairo
 *                 prayerCalculationMethod: EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY
 *                 points: 2450
 *                 level: 5
 *                 joinedAt: '2026-05-10T08:00:00.000Z'
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: تعديل الاسم والمدينة
 *               value:
 *                 fullName: مريم خالد محمود
 *                 city: الإسكندرية
 *                 avatarUrl: https://cdn.noor.app/avatars/new_avatar.jpg
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
 *             example:
 *               success: true
 *               message: تم تعديل بيانات الملف الشخصي بنجاح
 *               data:
 *                 id: clx8abc123def456ghi
 *                 username: noor_user
 *                 email: noor@example.com
 *                 fullName: مريم خالد محمود
 *                 avatarUrl: https://cdn.noor.app/avatars/new_avatar.jpg
 *                 phone: +201001234567
 *                 city: الإسكندرية
 *                 country: Egypt
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 timezone: Africa/Cairo
 *                 prayerCalculationMethod: EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY
 *                 points: 2450
 *                 level: 5
 *                 joinedAt: '2026-05-10T08:00:00.000Z'
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لتغيير كلمة المرور
 *               value:
 *                 currentPassword: OldPass123!
 *                 newPassword: NewStrongPass456!
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
 *             example:
 *               success: true
 *               message: تم تغيير كلمة المرور بنجاح
 *               data: true
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: كلمة المرور الحالية غير صحيحة أو الجديدة لا تستوفي الشروط الأمنية
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: INVALID_CURRENT_PASSWORD
 *               message: كلمة المرور الحالية غير صحيحة
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: تحديث الموقع إلى القاهرة
 *               value:
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 timezone: Africa/Cairo
 *                 city: القاهرة
 *                 country: Egypt
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
 *             example:
 *               success: true
 *               message: تم حفظ الموقع الجغرافي بنجاح
 *               data:
 *                 id: clx8abc123def456ghi
 *                 username: noor_user
 *                 email: noor@example.com
 *                 fullName: مريم خالد
 *                 avatarUrl: https://cdn.noor.app/avatars/user123.jpg
 *                 phone: +201001234567
 *                 city: القاهرة
 *                 country: Egypt
 *                 latitude: 30.0444
 *                 longitude: 31.2357
 *                 timezone: Africa/Cairo
 *                 prayerCalculationMethod: EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY
 *                 points: 2450
 *                 level: 5
 *                 joinedAt: '2026-05-10T08:00:00.000Z'
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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

/**
 * @openapi
 * /profile/reading-preferences:
 *   get:
 *     tags: ['Profile']
 *     summary: إعدادات قراءة القرآن للمستخدم (شاشة إعدادات القارئ)
 *     description: |
 *       يعرض إعدادات القارئ الحالية المستخدمة في شاشة القرآن:
 *       - حجم الخط (quranFontSize): افتراضي 28 (12..60)
 *       - القارئ المفضل للاستماع (quranReciter): مثل Mishary_Alafasy
 *       - مصدر التفسير (quranTafsir): مثل Ibn_Kathir
 *       - مصدر الترجمة (quranTranslation): مثل Sahih_International
 *     security: [ { bearerAuth: [] } ]
 *     responses:
 *       200:
 *         description: ✅ إعدادات القراءة الحالية
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Reading preferences retrieved successfully
 *               data:
 *                 quranFontSize: 28
 *                 quranReciter: Mishary_Alafasy
 *                 quranTafsir: Ibn_Kathir
 *                 quranTranslation: Sahih_International
 *                 quranAutoScrollEnabled: false
 *               timestamp: '2026-08-21T10:30:00.000Z'
 *               requestId: uuid
 */
profileRouter.get(
  '/reading-preferences',
  authenticate,
  profileController.getReadingPreferences,
);

/**
 * @openapi
 * /profile/reading-preferences:
 *   patch:
 *     tags: ['Profile']
 *     summary: تحديث إعدادات قراءة القرآن (حجم الخط، القارئ، التفسير، الترجمة، Auto-Scroll)
 *     description: |
 *       يقبل أي حقل من الحقول الخمسة جزئياً (partial update).
 *       يستخدم هذا عند ضغط المستخدم على أي خيار في شاشة إعدادات القارئ
 *       (تكبير/تصغير الخط أو اختيار قارئ أو تفسير أو ترجمة أو تفعيل Auto-Scroll).
 *     security: [ { bearerAuth: [] } ]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quranFontSize:
 *                 type: integer
 *                 minimum: 12
 *                 maximum: 60
 *                 example: 32
 *                 description: حجم الخط بالبكسل (AA icon)
 *               quranReciter:
 *                 type: string
 *                 maxLength: 100
 *                 example: Abdul_Basit
 *                 description: اسم القارئ المفضل للاستماع (🎧 icon)
 *               quranTafsir:
 *                 type: string
 *                 maxLength: 100
 *                 example: Al_Tabari
 *                 description: مصدر التفسير (✍️ icon)
 *               quranTranslation:
 *                 type: string
 *                 maxLength: 100
 *                 example: Yusuf_Ali
 *                 description: مصدر الترجمة (🌐 icon)
 *               quranAutoScrollEnabled:
 *                 type: boolean
 *                 example: true
 *                 description: تفعيل التمرير التلقائي أثناء قراءة القرآن (🔄 icon)
 *           examples:
 *             تكبير الخط فقط:
 *               value:
 *                 quranFontSize: 34
 *             تغيير القارئ والتفسير + تفعيل Auto-Scroll:
 *               value:
 *                 quranReciter: Saad_Al_Ghamdi
 *                 quranTafsir: Ibn_Kathir
 *                 quranAutoScrollEnabled: true
 *     responses:
 *       200:
 *         description: ✅ تم تحديث الإعدادات (يعرض كافة الإعدادات بعد التحديث)
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: Reading preferences updated successfully
 *               data:
 *                 quranFontSize: 32
 *                 quranReciter: Saad_Al_Ghamdi
 *                 quranTafsir: Ibn_Kathir
 *                 quranTranslation: Sahih_International
 *                 quranAutoScrollEnabled: true
 *               timestamp: '2026-08-21T10:30:00.000Z'
 *               requestId: uuid
 *       400:
 *         description: ❌ قيمة حجم الخط خارج النطاق (12..60)
 */
profileRouter.patch(
  '/reading-preferences',
  authenticate,
  validate(updateReadingPreferencesSchema),
  profileController.updateReadingPreferences,
);
