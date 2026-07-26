"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProfile = getProfile;
exports.updateProfile = updateProfile;
exports.changePassword = changePassword;
exports.updateLocation = updateLocation;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const auth_1 = require("../lib/auth");
async function getProfile(userId) {
    const profile = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            email: true,
            points: true,
            timezone: true,
            latitude: true,
            longitude: true,
        },
    });
    if (!profile) {
        throw new errors_1.AppError('User profile not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return profile;
}
async function updateProfile(userId, data) {
    if (data.email !== undefined) {
        const existingUser = await prisma_1.prisma.user.findUnique({
            where: { email: data.email.toLowerCase() },
            select: { id: true },
        });
        if (existingUser && existingUser.id !== userId) {
            throw new errors_1.AppError('Email is already in use by another account', config_1.HttpStatus.CONFLICT, config_1.ErrorCodes.CONFLICT);
        }
    }
    const updateData = {};
    if (data.username !== undefined)
        updateData.username = data.username;
    if (data.email !== undefined)
        updateData.email = data.email.toLowerCase();
    const updatedProfile = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            username: true,
            email: true,
            points: true,
            timezone: true,
            latitude: true,
            longitude: true,
        },
    });
    if (!updatedProfile) {
        throw new errors_1.AppError('User profile not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return updatedProfile;
}
async function changePassword(userId, data) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            password: true,
        },
    });
    if (!user) {
        throw new errors_1.AppError('User profile not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    if (!user.password) {
        throw new errors_1.AppError('Password change is not available for this account type', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const isCurrentPasswordValid = await (0, auth_1.verifyPassword)(data.currentPassword, user.password);
    if (!isCurrentPasswordValid) {
        throw new errors_1.AppError('Current password is incorrect', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.INVALID_CREDENTIALS);
    }
    const newPasswordHash = await (0, auth_1.hashPassword)(data.newPassword);
    await prisma_1.prisma.user.update({
        where: { id: userId },
        data: { password: newPasswordHash },
    });
    return true;
}
async function updateLocation(userId, data) {
    const updateData = {
        latitude: data.latitude,
        longitude: data.longitude,
    };
    if (data.timezone !== undefined) {
        updateData.timezone = data.timezone;
    }
    const updatedProfile = await prisma_1.prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
            id: true,
            username: true,
            email: true,
            points: true,
            timezone: true,
            latitude: true,
            longitude: true,
        },
    });
    if (!updatedProfile) {
        throw new errors_1.AppError('User profile not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return updatedProfile;
}
//# sourceMappingURL=profile.service.js.map