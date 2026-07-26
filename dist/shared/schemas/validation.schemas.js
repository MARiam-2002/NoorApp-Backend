"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.qiblaDirectionSchema = exports.claimChallengeRewardSchema = exports.completeChallengeSchema = exports.subscribeToNotificationsSchema = exports.notificationMarkReadSchema = exports.paginationSchema = exports.updateKhatmahSchema = exports.recordReadingHistorySchema = exports.updateLastReadSchema = exports.createBookmarkSchema = exports.getTasbihHistorySchema = exports.changeDhikrSchema = exports.incrementTasbihSchema = exports.markPrayerSchema = exports.updateProfileLocationSchema = exports.updateProfileSchema = exports.googleSignInSchema = exports.resetPasswordSchema = exports.forgotPasswordSchema = exports.refreshTokenSchema = exports.loginSchema = exports.signUpSchema = exports.coordinatesSchema = exports.ianaTimezoneSchema = exports.usernameSchema = exports.passwordSchema = exports.emailSchema = void 0;
const zod_1 = require("zod");
// Common patterns
exports.emailSchema = zod_1.z.string().trim().email('Invalid email address');
exports.passwordSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number');
exports.usernameSchema = zod_1.z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(100, 'Username must be at most 100 characters');
exports.ianaTimezoneSchema = zod_1.z.string().refine((tz) => {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
    }
    catch {
        return false;
    }
}, 'Invalid timezone');
exports.coordinatesSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
    longitude: zod_1.z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});
// ============= Auth Schemas =============
exports.signUpSchema = zod_1.z.object({
    username: exports.usernameSchema,
    email: exports.emailSchema,
    password: exports.passwordSchema,
});
exports.loginSchema = zod_1.z.object({
    email: exports.emailSchema,
    password: zod_1.z.string().min(1, 'Password is required'),
});
exports.refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
exports.forgotPasswordSchema = zod_1.z.object({
    email: exports.emailSchema,
});
exports.resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: exports.passwordSchema,
});
exports.googleSignInSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1, 'Google ID token is required'),
});
// ============= Profile Schemas =============
exports.updateProfileSchema = zod_1.z.object({
    username: exports.usernameSchema.optional(),
    timezone: exports.ianaTimezoneSchema.optional(),
});
exports.updateProfileLocationSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90),
    longitude: zod_1.z.number().min(-180).max(180),
});
// ============= Prayer Schemas =============
exports.markPrayerSchema = zod_1.z.object({
    prayer: zod_1.z.enum(['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']),
});
// ============= Tasbih Schemas =============
exports.incrementTasbihSchema = zod_1.z.object({
    amount: zod_1.z.number().int().positive('Amount must be greater than 0').optional().default(1),
});
exports.changeDhikrSchema = zod_1.z.object({
    dhikr: zod_1.z.enum([
        'SUBHAN_ALLAH',
        'ALHAMDULILLAH',
        'LA_ILAHA_ILLA_ALLAH',
        'ALLAHU_AKBAR',
        'ASTAGHFIRULLAH',
        'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH',
    ]),
});
exports.getTasbihHistorySchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(30),
});
// ============= Quran Schemas =============
exports.createBookmarkSchema = zod_1.z.object({
    surahId: zod_1.z.number().int().positive('Surah ID must be positive'),
    ayahNumber: zod_1.z.number().int().positive('Ayah number must be positive'),
    note: zod_1.z.string().max(500, 'Note must be at most 500 characters').optional(),
});
exports.updateLastReadSchema = zod_1.z.object({
    surahId: zod_1.z.number().int().positive('Surah ID must be positive'),
    ayahNumber: zod_1.z.number().int().positive('Ayah number must be positive'),
    page: zod_1.z.number().int().positive('Page must be positive').optional(),
});
exports.recordReadingHistorySchema = zod_1.z.object({
    surahId: zod_1.z.number().int().positive('Surah ID must be positive'),
    ayahFrom: zod_1.z.number().int().positive('Ayah From must be positive'),
    ayahTo: zod_1.z.number().int().positive('Ayah To must be positive'),
    page: zod_1.z.number().int().positive('Page must be positive').optional(),
});
exports.updateKhatmahSchema = zod_1.z.object({
    surahId: zod_1.z.number().int().positive('Surah ID must be positive'),
    page: zod_1.z.number().int().positive('Page must be positive'),
    pagesRead: zod_1.z.number().int().positive().optional().default(1),
});
// ============= Pagination Schemas =============
exports.paginationSchema = zod_1.z.object({
    page: zod_1.z.coerce.number().int().positive().optional().default(1),
    limit: zod_1.z.coerce.number().int().positive().max(100).optional().default(20),
});
// ============= Notification Schemas =============
exports.notificationMarkReadSchema = zod_1.z.object({
    read: zod_1.z.boolean().optional().default(true),
});
exports.subscribeToNotificationsSchema = zod_1.z.object({
    fcmToken: zod_1.z.string().min(1, 'FCM token is required'),
});
// ============= Challenge Schemas =============
exports.completeChallengeSchema = zod_1.z.object({
    value: zod_1.z.number().int().positive('Value must be positive').optional(),
});
exports.claimChallengeRewardSchema = zod_1.z.object({
// Empty body - just claiming
});
// ============= Qibla Schemas =============
exports.qiblaDirectionSchema = zod_1.z.object({
    latitude: zod_1.z.number().min(-90).max(90).optional(),
    longitude: zod_1.z.number().min(-180).max(180).optional(),
});
//# sourceMappingURL=validation.schemas.js.map