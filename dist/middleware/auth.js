"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticate = authenticate;
exports.optionalAuthenticate = optionalAuthenticate;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const prisma_1 = require("../lib/prisma");
const auth_1 = require("../lib/auth");
function extractBearerToken(authorizationHeader) {
    if (!authorizationHeader?.startsWith('Bearer '))
        return null;
    const token = authorizationHeader.slice(7).trim();
    return token.length > 0 ? token : null;
}
async function authenticate(req, _res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        if (!token) {
            throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
        }
        const payload = (0, auth_1.verifyAccessToken)(token);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.isActive) {
            throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
        }
        req.user = {
            sub: payload.userId,
            email: payload.email,
            role: user.role || 'USER',
        };
        next();
    }
    catch (error) {
        next(error);
    }
}
async function optionalAuthenticate(req, _res, next) {
    try {
        const token = extractBearerToken(req.headers.authorization);
        if (!token)
            return next();
        const payload = (0, auth_1.verifyAccessToken)(token);
        const user = await prisma_1.prisma.user.findUnique({ where: { id: payload.userId } });
        if (!user || !user.isActive)
            return next();
        req.user = {
            sub: payload.userId,
            email: payload.email,
            role: user.role || 'USER',
        };
        next();
    }
    catch {
        next();
    }
}
//# sourceMappingURL=auth.js.map