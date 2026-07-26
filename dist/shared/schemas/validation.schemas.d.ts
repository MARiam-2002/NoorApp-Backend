import { z } from 'zod';
export declare const emailSchema: z.ZodString;
export declare const passwordSchema: z.ZodString;
export declare const usernameSchema: z.ZodString;
export declare const ianaTimezoneSchema: z.ZodString;
export declare const coordinatesSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
}, z.core.$strip>;
export declare const signUpSchema: z.ZodObject<{
    username: z.ZodString;
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const refreshTokenSchema: z.ZodObject<{
    refreshToken: z.ZodString;
}, z.core.$strip>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordSchema: z.ZodObject<{
    token: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const googleSignInSchema: z.ZodObject<{
    idToken: z.ZodString;
}, z.core.$strip>;
export declare const updateProfileSchema: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    timezone: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateProfileLocationSchema: z.ZodObject<{
    latitude: z.ZodNumber;
    longitude: z.ZodNumber;
}, z.core.$strip>;
export declare const markPrayerSchema: z.ZodObject<{
    prayer: z.ZodEnum<{
        FAJR: "FAJR";
        DHUHR: "DHUHR";
        ASR: "ASR";
        MAGHRIB: "MAGHRIB";
        ISHA: "ISHA";
    }>;
}, z.core.$strip>;
export declare const incrementTasbihSchema: z.ZodObject<{
    amount: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const changeDhikrSchema: z.ZodObject<{
    dhikr: z.ZodEnum<{
        SUBHAN_ALLAH: "SUBHAN_ALLAH";
        ALHAMDULILLAH: "ALHAMDULILLAH";
        LA_ILAHA_ILLA_ALLAH: "LA_ILAHA_ILLA_ALLAH";
        ALLAHU_AKBAR: "ALLAHU_AKBAR";
        ASTAGHFIRULLAH: "ASTAGHFIRULLAH";
        LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH: "LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH";
    }>;
}, z.core.$strip>;
export declare const getTasbihHistorySchema: z.ZodObject<{
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const createBookmarkSchema: z.ZodObject<{
    surahId: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    note: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const updateLastReadSchema: z.ZodObject<{
    surahId: z.ZodNumber;
    ayahNumber: z.ZodNumber;
    page: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const recordReadingHistorySchema: z.ZodObject<{
    surahId: z.ZodNumber;
    ayahFrom: z.ZodNumber;
    ayahTo: z.ZodNumber;
    page: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const updateKhatmahSchema: z.ZodObject<{
    surahId: z.ZodNumber;
    page: z.ZodNumber;
    pagesRead: z.ZodDefault<z.ZodOptional<z.ZodNumber>>;
}, z.core.$strip>;
export declare const paginationSchema: z.ZodObject<{
    page: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    limit: z.ZodDefault<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
}, z.core.$strip>;
export declare const notificationMarkReadSchema: z.ZodObject<{
    read: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
}, z.core.$strip>;
export declare const subscribeToNotificationsSchema: z.ZodObject<{
    fcmToken: z.ZodString;
}, z.core.$strip>;
export declare const completeChallengeSchema: z.ZodObject<{
    value: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const claimChallengeRewardSchema: z.ZodObject<{}, z.core.$strip>;
export declare const qiblaDirectionSchema: z.ZodObject<{
    latitude: z.ZodOptional<z.ZodNumber>;
    longitude: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
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
//# sourceMappingURL=validation.schemas.d.ts.map