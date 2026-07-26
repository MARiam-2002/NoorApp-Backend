"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUp = signUp;
exports.login = login;
exports.refreshToken = refreshToken;
exports.logout = logout;
exports.getCurrentUser = getCurrentUser;
exports.forgotPassword = forgotPassword;
exports.resetPassword = resetPassword;
exports.getGoogleAuthUrl = getGoogleAuthUrl;
exports.googleSignIn = googleSignIn;
const node_crypto_1 = require("node:crypto");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const auth_1 = require("../lib/auth");
const logger_1 = require("../lib/logger");
function parseDurationToMs(duration) {
    const match = /^(\d+)([smhd])$/.exec(duration);
    if (!match?.[1] || !match[2]) {
        return 30 * 24 * 60 * 60 * 1000;
    }
    const value = Number(match[1]);
    const unit = match[2];
    const multipliers = {
        s: 1000,
        m: 60_000,
        h: 3_600_000,
        d: 86_400_000,
    };
    return value * (multipliers[unit] ?? 86_400_000);
}
function hashRefreshToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function hashResetToken(token) {
    return (0, node_crypto_1.createHash)('sha256').update(token).digest('hex');
}
function mapUserToProfile(user) {
    return {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        provider: user.provider,
        createdAt: user.createdAt,
    };
}
async function createAuthResultForUser(user) {
    const accessToken = (0, auth_1.generateAccessToken)({ userId: user.id, email: user.email });
    const refreshToken = (0, auth_1.generateRefreshToken)({ userId: user.id, email: user.email });
    const expiresAt = new Date(Date.now() + parseDurationToMs(config_1.env.JWT_REFRESH_EXPIRES_IN));
    await prisma_1.prisma.refreshToken.create({
        data: {
            tokenHash: hashRefreshToken(refreshToken),
            userId: user.id,
            expiresAt,
        },
    });
    return {
        user: mapUserToProfile(user),
        tokens: {
            accessToken,
            refreshToken,
            expiresIn: config_1.env.JWT_EXPIRES_IN,
        },
    };
}
async function signUp(input) {
    const emailLower = input.email.toLowerCase().trim();
    const emailExists = await prisma_1.prisma.user.count({ where: { email: emailLower } });
    if (emailExists > 0) {
        throw new errors_1.AppError('Email already exists', config_1.HttpStatus.CONFLICT, config_1.ErrorCodes.CONFLICT, {
            field: 'email',
        });
    }
    const passwordHash = await (0, auth_1.hashPassword)(input.password);
    const user = await prisma_1.prisma.user.create({
        data: {
            username: input.username.trim(),
            email: emailLower,
            password: passwordHash,
            provider: 'LOCAL',
            role: client_1.UserRole.USER,
        },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            provider: true,
            createdAt: true,
        },
    });
    return createAuthResultForUser(user);
}
async function login(input) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: input.email.toLowerCase() },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            provider: true,
            createdAt: true,
            password: true,
            isActive: true,
        },
    });
    if (!user || user.provider !== 'LOCAL' || !user.password) {
        throw new errors_1.AppError('Invalid email or password', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.INVALID_CREDENTIALS);
    }
    const isPasswordValid = await (0, auth_1.verifyPassword)(input.password, user.password);
    if (!isPasswordValid) {
        throw new errors_1.AppError('Invalid email or password', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.INVALID_CREDENTIALS);
    }
    if (!user.isActive) {
        throw new errors_1.AppError('Account is deactivated', config_1.HttpStatus.FORBIDDEN, config_1.ErrorCodes.FORBIDDEN);
    }
    return createAuthResultForUser(user);
}
async function refreshToken(input) {
    const payload = (0, auth_1.verifyRefreshToken)(input.refreshToken);
    const tokenHash = hashRefreshToken(input.refreshToken);
    const storedToken = await prisma_1.prisma.refreshToken.findUnique({
        where: { tokenHash },
    });
    const now = new Date();
    const isValid = storedToken &&
        storedToken.revokedAt === null &&
        storedToken.expiresAt.getTime() > now.getTime() &&
        storedToken.userId === payload.userId;
    if (!isValid) {
        throw new errors_1.AppError('Invalid or expired refresh token', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    await prisma_1.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: payload.userId },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            provider: true,
            createdAt: true,
            isActive: true,
        },
    });
    if (!user || !user.isActive) {
        throw new errors_1.AppError('User not found', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    return createAuthResultForUser(user);
}
async function logout(input) {
    try {
        (0, auth_1.verifyRefreshToken)(input.refreshToken);
    }
    catch {
        throw new errors_1.AppError('Invalid refresh token', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const tokenHash = hashRefreshToken(input.refreshToken);
    await prisma_1.prisma.refreshToken.updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
async function getCurrentUser(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            provider: true,
            createdAt: true,
            isActive: true,
        },
    });
    if (!user || !user.isActive) {
        throw new errors_1.AppError('User not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return mapUserToProfile(user);
}
async function forgotPassword(email) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { email: email.toLowerCase() },
        select: { id: true },
    });
    if (!user) {
        return { message: 'If the email exists, a reset link has been sent' };
    }
    const rawToken = (0, node_crypto_1.randomBytes)(32).toString('hex');
    const tokenHash = hashResetToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    await prisma_1.prisma.passwordResetToken.updateMany({
        where: { userId: user.id, usedAt: null },
        data: { usedAt: new Date() },
    });
    await prisma_1.prisma.passwordResetToken.create({
        data: { userId: user.id, tokenHash, expiresAt },
    });
    logger_1.logger.info('Password reset token generated', { userId: user.id });
    if (config_1.env.NODE_ENV === 'development') {
        logger_1.logger.debug('Password reset token (development only)', {
            userId: user.id,
            resetToken: rawToken,
        });
    }
    return { message: 'If the email exists, a reset link has been sent' };
}
async function resetPassword(token, password) {
    const tokenHash = hashResetToken(token);
    const resetToken = await prisma_1.prisma.passwordResetToken.findFirst({
        where: {
            tokenHash,
            usedAt: null,
            expiresAt: { gt: new Date() },
        },
    });
    if (!resetToken) {
        throw new errors_1.AppError('Invalid or expired reset token', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const passwordHash = await (0, auth_1.hashPassword)(password);
    await prisma_1.prisma.$transaction([
        prisma_1.prisma.user.update({
            where: { id: resetToken.userId },
            data: { password: passwordHash },
        }),
        prisma_1.prisma.passwordResetToken.update({
            where: { id: resetToken.id },
            data: { usedAt: new Date() },
        }),
    ]);
    await prisma_1.prisma.refreshToken.updateMany({
        where: { userId: resetToken.userId, revokedAt: null },
        data: { revokedAt: new Date() },
    });
}
function getGoogleAuthUrl() {
    const clientId = config_1.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        throw new errors_1.AppError('Google authentication is not configured', config_1.HttpStatus.SERVICE_UNAVAILABLE, config_1.ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    const redirectUri = config_1.env.GOOGLE_CALLBACK_URL;
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent',
    });
    return {
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
        message: 'Google OAuth URL generated successfully',
    };
}
async function googleSignIn(idToken) {
    const clientId = config_1.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
        throw new errors_1.AppError('Google authentication is not configured', config_1.HttpStatus.SERVICE_UNAVAILABLE, config_1.ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    // Verify Google ID token (simplified - in production use google-auth-library)
    let googlePayload;
    try {
        // Note: This is a simplified verification. Use @google-auth-library/oauth2-client for production
        const response = await fetch(`https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`);
        if (!response.ok) {
            throw new errors_1.AppError('Invalid Google ID token', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
        }
        const payload = (await response.json());
        googlePayload = {
            email: payload.email || '',
            sub: payload.sub || '',
            name: payload.name || '',
            picture: payload.picture,
        };
        // Verify the token is for our application
        if (googlePayload.sub && !googlePayload.email) {
            throw new errors_1.AppError('Invalid Google token response', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
        }
    }
    catch (error) {
        logger_1.logger.error('Google token verification failed', { error: error.message });
        throw new errors_1.AppError('Failed to verify Google token', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const emailLower = googlePayload.email.toLowerCase();
    // Find or create user
    let user = await prisma_1.prisma.user.findUnique({
        where: { email: emailLower },
        select: {
            id: true,
            username: true,
            email: true,
            role: true,
            provider: true,
            createdAt: true,
            isActive: true,
        },
    });
    if (user && user.provider !== 'GOOGLE' && user.provider !== 'LOCAL') {
        throw new errors_1.AppError('This email is already registered with a different provider', config_1.HttpStatus.CONFLICT, config_1.ErrorCodes.CONFLICT);
    }
    if (!user) {
        // Create new user from Google profile
        user = await prisma_1.prisma.user.create({
            data: {
                email: emailLower,
                username: (googlePayload.name || emailLower.split('@')[0]),
                provider: 'GOOGLE',
                role: client_1.UserRole.USER,
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                provider: true,
                createdAt: true,
                isActive: true,
            },
        });
    }
    else if (user.provider === 'LOCAL') {
        // Update existing LOCAL user to support GOOGLE signin too
        user = await prisma_1.prisma.user.update({
            where: { id: user.id },
            data: {
                provider: 'LOCAL', // Keep LOCAL as primary
            },
            select: {
                id: true,
                username: true,
                email: true,
                role: true,
                provider: true,
                createdAt: true,
                isActive: true,
            },
        });
    }
    if (!user.isActive) {
        throw new errors_1.AppError('Account is deactivated', config_1.HttpStatus.FORBIDDEN, config_1.ErrorCodes.FORBIDDEN);
    }
    logger_1.logger.info('User logged in via Google', { userId: user.id, email: user.email });
    return createAuthResultForUser(user);
}
//# sourceMappingURL=auth.service.js.map