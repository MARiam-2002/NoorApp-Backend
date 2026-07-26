import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../middleware/auth';
import {
  authRateLimiter,
  authSensitiveRateLimiter,
} from '../middleware/http';
import { validate, passwordFieldSchema } from '../lib/validation';
import * as authController from '../controllers/auth.controller';

const signUpSchema = z.object({
  username: z
    .string()
    .trim()
    .min(2, 'Username must be at least 2 characters')
    .max(100, 'Username must be at most 100 characters'),
  email: z.string().trim().email('Invalid email'),
  password: passwordFieldSchema,
});

const loginSchema = z.object({
  email: z.string().trim().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

const logoutSchema = refreshTokenSchema;

const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email'),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: passwordFieldSchema,
});

const googleSignInSchema = z.object({
  idToken: z.string().min(1, 'Google ID token is required'),
});

/**
 * @openapi
 * /auth/sign-up:
 *   post:
 *     tags: ['Auth']
 *     summary: إنشاء حساب جديد بالبريد الإلكتروني
 *     description: تسجيل مستخدم جديد مع اسم المستخدم والبريد وكلمة المرور. يرجع access token + refresh token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SignupRequest'
 *     responses:
 *       201:
 *         description: ✅ تم إنشاء الحساب بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: ❌ بيانات غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: ❌ البريد الإلكتروني مستخدم بالفعل
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /auth/login:
 *   post:
 *     tags: ['Auth']
 *     summary: تسجيل الدخول بالبريد الإلكتروني وكلمة المرور
 *     description: دخول المستخدم لحسابه ويرجع access token + refresh token صالحين.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *     responses:
 *       200:
 *         description: ✅ تم تسجيل الدخول بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthResponse'
 *       401:
 *         description: ❌ بيانات اعتماد غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @openapi
 * /auth/refresh:
 *   post:
 *     tags: ['Auth']
 *     summary: تجديد Access Token
 *     description: يستخدم Refresh Token للحصول على access token جديد قبل انتهاء الصلاحية.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.refresh
 *     responses:
 *       200:
 *         description: ✅ تم تجديد التوكن بنجاح
 *       401:
 *         description: ❌ Refresh Token غير صالح أو منتهي
 */

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     tags: ['Auth']
 *     summary: تسجيل الخروج وإبطال Refresh Token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [refreshToken]
 *             properties:
 *               refreshToken: { type: string }
 *     responses:
 *       200:
 *         description: ✅ تم تسجيل الخروج بنجاح
 */

/**
 * @openapi
 * /auth/me:
 *   get:
 *     tags: ['Auth']
 *     summary: جلب بيانات المستخدم المسجل دخوله حالياً
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: ✅ بيانات المستخدم الحالي
 *       401:
 *         description: ❌ غير مصرح به - التوكن غير صالح
 */

/**
 * @openapi
 * /auth/forgot-password:
 *   post:
 *     tags: ['Auth']
 *     summary: طلب إعادة تعيين كلمة المرور
 *     description: يرسل رابط إعادة التعيين إلى البريد الإلكتروني إذا كان مسجلاً.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email]
 *             properties:
 *               email: { type: string, format: email }
 *     responses:
 *       200:
 *         description: ✅ تم إرسال التعليمات إذا كان الحساب موجوداً
 */

/**
 * @openapi
 * /auth/reset-password:
 *   post:
 *     tags: ['Auth']
 *     summary: إعادة تعيين كلمة المرور بالتوكن
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [token, password]
 *             properties:
 *               token: { type: string }
 *               password: { type: string, format: password }
 *     responses:
 *       200:
 *         description: ✅ تم تغيير كلمة المرور بنجاح
 */

/**
 * @openapi
 * /auth/google/url:
 *   get:
 *     tags: ['Auth']
 *     summary: جلب رابط تسجيل الدخول عبر Google
 *     description: Flutter يفتح هذا الرابط في WebView لعملية Google OAuth.
 *     responses:
 *       200:
 *         description: ✅ رابط تسجيل دخول جوجل
 */

/**
 * @openapi
 * /auth/google:
 *   post:
 *     tags: ['Auth']
 *     summary: تسجيل الدخول/الاشتراك عبر Google (ID Token)
 *     description: يستخدمه Flutter بعد نجاح تسجيل الدخول عبر Google - يرسل idToken ويصير لديه account جديد أو تسجيل دخول تلقائي.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GoogleAuthRequest'
 *     responses:
 *       200:
 *         description: ✅ تم الدخول عبر جوجل بنجاح
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/ApiResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: ❌ Google Token غير صالح
 */
export const authRouter = Router();

authRouter.use(authRateLimiter);

authRouter.post(
  '/sign-up',
  authSensitiveRateLimiter,
  validate(signUpSchema),
  authController.signUp,
);

authRouter.post(
  '/login',
  authSensitiveRateLimiter,
  validate(loginSchema),
  authController.login,
);

authRouter.post(
  '/refresh',
  validate(refreshTokenSchema),
  authController.refreshToken,
);

authRouter.post(
  '/logout',
  validate(logoutSchema),
  authController.logout,
);

authRouter.get(
  '/me',
  authenticate,
  authController.getCurrentUser,
);

authRouter.post(
  '/forgot-password',
  authSensitiveRateLimiter,
  validate(forgotPasswordSchema),
  authController.forgotPassword,
);

authRouter.post(
  '/reset-password',
  authSensitiveRateLimiter,
  validate(resetPasswordSchema),
  authController.resetPassword,
);

authRouter.get(
  '/google/url',
  authController.getGoogleAuthUrl,
);

authRouter.post(
  '/google',
  validate(googleSignInSchema),
  authController.googleSignIn,
);
