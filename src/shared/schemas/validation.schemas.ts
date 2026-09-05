import { z } from 'zod';

// Common patterns
export const emailSchema = z.string().trim().email('Invalid email address');
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password must be at most 128 characters')
  .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number');

export const usernameSchema = z
  .string()
  .trim()
  .min(2, 'Username must be at least 2 characters')
  .max(100, 'Username must be at most 100 characters');

export const ianaTimezoneSchema = z.string().refine(
  (tz) => {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  },
  'Invalid timezone',
);

export const coordinatesSchema = z.object({
  latitude: z.number().min(-90).max(90, 'Latitude must be between -90 and 90'),
  longitude: z.number().min(-180).max(180, 'Longitude must be between -180 and 180'),
});

// ============= Auth Schemas =============
export const signUpSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(150, 'Full name must be at most 150 characters')
    .optional()
    .nullable(),
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(100, 'Username must be at most 100 characters')
    .optional(),
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, 'Reset token is required'),
    password: passwordSchema.optional(),
    newPassword: passwordSchema.optional(),
  })
  .refine((body) => Boolean(body.password || body.newPassword), {
    message: 'Password is required',
    path: ['password'],
  });

export const googleSignInSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

// ============= Profile Schemas =============
export const updateProfileSchema = z.object({
  username: usernameSchema.optional(),
  timezone: ianaTimezoneSchema.optional(),
});

export const updateProfileLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

// ============= Prayer Schemas =============
export const markPrayerSchema = z.object({
  prayer: z.enum(['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']),
});

// ============= Tasbih Schemas =============
export const incrementTasbihSchema = z.object({
  amount: z.number().int().positive('Amount must be greater than 0').optional().default(1),
});

export const changeDhikrSchema = z.object({
  dhikr: z.enum([
    'SUBHAN_ALLAH',
    'ALHAMDULILLAH',
    'LA_ILAHA_ILLA_ALLAH',
    'ALLAHU_AKBAR',
    'ASTAGHFIRULLAH',
    'LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH',
    'SUBHAN_ALLAHI_WA_BIHAMDIHI',
    'LA_ILAHA_ILLA_ALLAH_WAHDAHU',
    'SUBHAN_ALLAHI_WA_BIHAMDIHI_SUBHAN_ALLAHI_L_AZIM',
  ]),
});

export const getTasbihHistorySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(30),
});

// ============= Quran Schemas =============
export const createBookmarkSchema = z.object({
  surahId: z.number().int().positive('Surah ID must be positive'),
  ayahNumber: z.number().int().positive('Ayah number must be positive'),
  note: z.string().max(500, 'Note must be at most 500 characters').optional(),
});

export const updateLastReadSchema = z.object({
  surahId: z.number().int().positive('Surah ID must be positive'),
  ayahNumber: z.number().int().positive('Ayah number must be positive'),
  page: z.number().int().positive('Page must be positive').optional(),
});

export const recordReadingHistorySchema = z.object({
  surahId: z.number().int().positive('Surah ID must be positive'),
  ayahFrom: z.number().int().positive('Ayah From must be positive'),
  ayahTo: z.number().int().positive('Ayah To must be positive'),
  page: z.number().int().positive('Page must be positive').optional(),
});

export const updateKhatmahSchema = z.object({
  surahId: z.number().int().positive('Surah ID must be positive'),
  page: z.number().int().positive('Page must be positive'),
  pagesRead: z.number().int().positive().optional().default(1),
});

// ============= Pagination Schemas =============
export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().positive().max(100).optional().default(20),
});

// ============= Notification Schemas =============
export const notificationMarkReadSchema = z.object({
  read: z.boolean().optional().default(true),
});

export const subscribeToNotificationsSchema = z.object({
  fcmToken: z.string().min(1, 'FCM token is required'),
});

// ============= Challenge Schemas =============
export const completeChallengeSchema = z.object({
  value: z.number().int().positive('Value must be positive').optional(),
});

export const claimChallengeRewardSchema = z.object({
  // Empty body - just claiming
});

// ============= Qibla Schemas =============
export const qiblaDirectionSchema = z.object({
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

// Type exports for convenient usage
export type SignUpInput = z.infer<typeof signUpSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type UpdateProfileLocationInput = z.infer<typeof updateProfileLocationSchema>;
export type MarkPrayerInput = z.infer<typeof markPrayerSchema>;
export type IncrementTasbihInput = z.infer<typeof incrementTasbihSchema>;
export type ChangeDhikrInput = z.infer<typeof changeDhikrSchema>;
export type CreateBookmarkInput = z.infer<typeof createBookmarkSchema>;
export type UpdateLastReadInput = z.infer<typeof updateLastReadSchema>;
export type RecordReadingHistoryInput = z.infer<typeof recordReadingHistorySchema>;
export type UpdateKhatmahInput = z.infer<typeof updateKhatmahSchema>;
