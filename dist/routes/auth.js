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
exports.authRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const auth_1 = require("../middleware/auth");
const http_1 = require("../middleware/http");
const validation_1 = require("../lib/validation");
const authController = __importStar(require("../controllers/auth.controller"));
const signUpSchema = zod_1.z.object({
    username: zod_1.z
        .string()
        .trim()
        .min(2, 'Username must be at least 2 characters')
        .max(100, 'Username must be at most 100 characters'),
    email: zod_1.z.string().trim().email('Invalid email'),
    password: validation_1.passwordFieldSchema,
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Invalid email'),
    password: zod_1.z.string().min(1, 'Password is required'),
});
const refreshTokenSchema = zod_1.z.object({
    refreshToken: zod_1.z.string().min(1, 'Refresh token is required'),
});
const logoutSchema = refreshTokenSchema;
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().trim().email('Invalid email'),
});
const resetPasswordSchema = zod_1.z.object({
    token: zod_1.z.string().min(1, 'Reset token is required'),
    password: validation_1.passwordFieldSchema,
});
const googleSignInSchema = zod_1.z.object({
    idToken: zod_1.z.string().min(1, 'Google ID token is required'),
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
exports.authRouter = (0, express_1.Router)();
exports.authRouter.use(http_1.authRateLimiter);
exports.authRouter.post('/sign-up', http_1.authSensitiveRateLimiter, (0, validation_1.validate)(signUpSchema), authController.signUp);
exports.authRouter.post('/login', http_1.authSensitiveRateLimiter, (0, validation_1.validate)(loginSchema), authController.login);
exports.authRouter.post('/refresh', (0, validation_1.validate)(refreshTokenSchema), authController.refreshToken);
exports.authRouter.post('/logout', (0, validation_1.validate)(logoutSchema), authController.logout);
exports.authRouter.get('/me', auth_1.authenticate, authController.getCurrentUser);
exports.authRouter.post('/forgot-password', http_1.authSensitiveRateLimiter, (0, validation_1.validate)(forgotPasswordSchema), authController.forgotPassword);
exports.authRouter.post('/reset-password', http_1.authSensitiveRateLimiter, (0, validation_1.validate)(resetPasswordSchema), authController.resetPassword);
exports.authRouter.get('/google/url', authController.getGoogleAuthUrl);
exports.authRouter.post('/google', (0, validation_1.validate)(googleSignInSchema), authController.googleSignIn);
//# sourceMappingURL=auth.js.map