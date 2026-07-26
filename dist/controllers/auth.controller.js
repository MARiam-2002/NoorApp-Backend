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
exports.googleSignIn = exports.getGoogleAuthUrl = exports.resetPassword = exports.forgotPassword = exports.getCurrentUser = exports.logout = exports.refreshToken = exports.login = exports.signUp = void 0;
const common_1 = require("../middleware/common");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const authService = __importStar(require("../services/auth.service"));
exports.signUp = (0, common_1.asyncHandler)(async (req, res) => {
    const { username, email, password } = req.body;
    const result = await authService.signUp({ username, email, password });
    (0, common_1.sendSuccess)(res, result, 'Account created successfully', config_1.HttpStatus.CREATED);
});
exports.login = (0, common_1.asyncHandler)(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login({ email, password });
    (0, common_1.sendSuccess)(res, result, 'Logged in successfully');
});
exports.refreshToken = (0, common_1.asyncHandler)(async (req, res) => {
    const { refreshToken: token } = req.body;
    const result = await authService.refreshToken({ refreshToken: token });
    (0, common_1.sendSuccess)(res, result, 'Token refreshed successfully');
});
exports.logout = (0, common_1.asyncHandler)(async (req, res) => {
    const { refreshToken: token } = req.body;
    await authService.logout({ refreshToken: token });
    (0, common_1.sendSuccess)(res, null, 'Logged out successfully');
});
exports.getCurrentUser = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const user = await authService.getCurrentUser(userId);
    (0, common_1.sendSuccess)(res, user, 'Current user retrieved successfully');
});
exports.forgotPassword = (0, common_1.asyncHandler)(async (req, res) => {
    const { email } = req.body;
    const result = await authService.forgotPassword(email);
    (0, common_1.sendSuccess)(res, result, result.message);
});
exports.resetPassword = (0, common_1.asyncHandler)(async (req, res) => {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    (0, common_1.sendSuccess)(res, null, 'Password reset successfully');
});
exports.getGoogleAuthUrl = (0, common_1.asyncHandler)(async (_req, res) => {
    const result = authService.getGoogleAuthUrl();
    (0, common_1.sendSuccess)(res, result, result.message);
});
exports.googleSignIn = (0, common_1.asyncHandler)(async (req, res) => {
    const { idToken } = req.body;
    const result = await authService.googleSignIn(idToken);
    (0, common_1.sendSuccess)(res, result, 'Logged in with Google successfully');
});
//# sourceMappingURL=auth.controller.js.map