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
 *           examples:
 *             default:
 *               summary: مثال لإنشاء حساب
 *               value:
 *                 username: noor_user
 *                 email: noor@example.com
 *                 password: StrongPass123!
 *                 fullName: مريم خالد
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
 *             example:
 *               success: true
 *               message: تم إنشاء الحساب بنجاح
 *               data:
 *                 user:
 *                   id: clx8abc123def456ghi
 *                   username: noor_user
 *                   email: noor@example.com
 *                   fullName: مريم خالد
 *                   createdAt: '2026-07-27T10:30:00.000Z'
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwiaWF0IjoxNzIxOTg2NjAwLCJleHAiOjE3MjE5ODc1MDB9.abc123xyz
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5ODY2MDAsImV4cCI6MTcyNDU3ODYwMH0.refresh.abc123
 *                 tokenType: Bearer
 *                 expiresIn: 900
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: ❌ بيانات غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: VALIDATION_ERROR
 *               message: كلمة المرور قصيرة جداً (6 أحرف على الأقل)
 *               details: [{ field: password, message: 'String must contain at least 6 character(s)' }]
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       409:
 *         description: ❌ البريد الإلكتروني مستخدم بالفعل
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: DUPLICATE_EMAIL
 *               message: البريد الإلكتروني مستخدم بالفعل
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لتسجيل الدخول
 *               value:
 *                 email: noor@example.com
 *                 password: StrongPass123!
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
 *             example:
 *               success: true
 *               message: تم تسجيل الدخول بنجاح
 *               data:
 *                 user:
 *                   id: clx8abc123def456ghi
 *                   username: noor_user
 *                   email: noor@example.com
 *                   fullName: مريم خالد
 *                   createdAt: '2026-07-27T10:30:00.000Z'
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwiaWF0IjoxNzIxOTg2NjAwLCJleHAiOjE3MjE5ODc1MDB9.abc123xyz
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5ODY2MDAsImV4cCI6MTcyNDU3ODYwMH0.refresh.abc123
 *                 tokenType: Bearer
 *                 expiresIn: 900
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         description: ❌ بيانات اعتماد غير صالحة
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: INVALID_CREDENTIALS
 *               message: البريد الإلكتروني أو كلمة المرور غير صحيحة
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لتجديد التوكن
 *               value:
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5ODY2MDAsImV4cCI6MTcyNDU3ODYwMH0.refresh.abc123
 *     responses:
 *       200:
 *         description: ✅ تم تجديد التوكن بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تجديد التوكن بنجاح
 *               data:
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwiaWF0IjoxNzIxOTk1MjAwLCJleHAiOjE3MjE5OTYxMDB9.newxyz123
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5OTA2MDAsImV4cCI6MTcyNDU4MjYwMH0.newrefresh456
 *                 tokenType: Bearer
 *                 expiresIn: 900
 *               meta: null
 *               timestamp: '2026-07-27T13:00:00.000Z'
 *       401:
 *         description: ❌ Refresh Token غير صالح أو منتهي
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: INVALID_REFRESH_TOKEN
 *               message: Refresh Token غير صالح أو منتهي الصلاحية
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لتسجيل الخروج
 *               value:
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5ODY2MDAsImV4cCI6MTcyNDU3ODYwMH0.refresh.abc123
 *     responses:
 *       200:
 *         description: ✅ تم تسجيل الخروج بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تسجيل الخروج بنجاح
 *               data: true
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: بيانات المستخدم الحالي
 *               data:
 *                 id: clx8abc123def456ghi
 *                 username: noor_user
 *                 email: noor@example.com
 *                 fullName: مريم خالد
 *                 createdAt: '2026-05-10T08:00:00.000Z'
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       401:
 *         description: ❌ غير مصرح به - التوكن غير صالح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: UNAUTHORIZED
 *               message: التوكن غير صالح أو منتهي الصلاحية
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لطلب إعادة التعيين
 *               value:
 *                 email: noor@example.com
 *     responses:
 *       200:
 *         description: ✅ تم إرسال التعليمات إذا كان الحساب موجوداً
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: إذا كان الحساب مسجلاً فسيصلك بريد إلكتروني به رابط إعادة تعيين كلمة المرور
 *               data: true
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لإعادة التعيين
 *               value:
 *                 token: eyJhbGciOiJIUzI1NiJ9.reset_token_123
 *                 password: NewStrongPass456!
 *     responses:
 *       200:
 *         description: ✅ تم تغيير كلمة المرور بنجاح
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم تغيير كلمة المرور بنجاح
 *               data: true
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: تم جلب رابط تسجيل الدخول عبر Google
 *               data:
 *                 url: https://accounts.google.com/o/oauth2/v2/auth?client_id=123.apps.googleusercontent.com&redirect_uri=https%3A%2F%2Fnoor.app%2Fauth%2Fgoogle%2Fcallback&response_type=code&scope=openid%20email%20profile
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
 *           examples:
 *             default:
 *               summary: مثال لتسجيل الدخول عبر جوجل
 *               value:
 *                 idToken: eyJhbGciOiJSUzI1NiIsImtpZCI6IjFlOWdkazcifQ.ewogImlzc3VlciI6ICJhY2NvdW50cy5nb29nbGUuY29tIiwKICAiYXpwIjogIjEyMy5hcHBzLmdvb2dsZXVzZXJjb250ZW50LmNvbSIKfQ==.signature123abc
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
 *             example:
 *               success: true
 *               message: تم تسجيل الدخول عبر Google بنجاح
 *               data:
 *                 user:
 *                   id: clx8abc123def456ghi
 *                   username: noor_google
 *                   email: noor@gmail.com
 *                   fullName: مريم خالد
 *                   createdAt: '2026-07-27T10:30:00.000Z'
 *                 accessToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwiaWF0IjoxNzIxOTg2NjAwLCJleHAiOjE3MjE5ODc1MDB9.abc123xyz
 *                 refreshToken: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJjbHg4YWJjMTIzZGVmNDU2Z2hpIiwidHlwZSI6InJlZnJlc2giLCJpYXQiOjE3MjE5ODY2MDAsImV4cCI6MTcyNDU3ODYwMH0.refresh.abc123
 *                 tokenType: Bearer
 *                 expiresIn: 900
 *               meta: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
 *       400:
 *         description: ❌ Google Token غير صالح
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               code: INVALID_GOOGLE_TOKEN
 *               message: Google ID Token غير صالح أو منتهي
 *               details: null
 *               timestamp: '2026-07-27T10:30:00.000Z'
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
