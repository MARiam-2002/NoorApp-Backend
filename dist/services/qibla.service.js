"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateQibla = calculateQibla;
exports.getMyQibla = getMyQibla;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const KAABA_LATITUDE = 21.4225;
const KAABA_LONGITUDE = 39.8262;
const DIRECTIONS = [
    { min: 337.5, max: 360, ar: 'الشمال', en: 'North' },
    { min: 0, max: 22.5, ar: 'الشمال', en: 'North' },
    { min: 22.5, max: 67.5, ar: 'الشمال الشرقي', en: 'Northeast' },
    { min: 67.5, max: 112.5, ar: 'الشرق', en: 'East' },
    { min: 112.5, max: 157.5, ar: 'الجنوب الشرقي', en: 'Southeast' },
    { min: 157.5, max: 202.5, ar: 'الجنوب', en: 'South' },
    { min: 202.5, max: 247.5, ar: 'الجنوب الغربي', en: 'Southwest' },
    { min: 247.5, max: 292.5, ar: 'الغرب', en: 'West' },
    { min: 292.5, max: 337.5, ar: 'الشمال الغربي', en: 'Northwest' },
];
function toRadians(degrees) {
    return (degrees * Math.PI) / 180;
}
function toDegrees(radians) {
    return (radians * 180) / Math.PI;
}
function normalizeAngle(angle) {
    return ((angle % 360) + 360) % 360;
}
function getDirectionNames(angle) {
    const direction = DIRECTIONS.find((d) => angle >= d.min && angle < d.max);
    return {
        directionAr: direction?.ar ?? 'الشمال',
        directionEn: direction?.en ?? 'North',
    };
}
function calculateQiblaDirection(latitude, longitude) {
    const phiK = toRadians(KAABA_LATITUDE);
    const lambdaK = toRadians(KAABA_LONGITUDE);
    const phi = toRadians(latitude);
    const lambda = toRadians(longitude);
    const deltaLambda = lambdaK - lambda;
    const y = Math.sin(deltaLambda);
    const x = Math.cos(phi) * Math.tan(phiK) - Math.sin(phi) * Math.cos(deltaLambda);
    const bearingRadians = Math.atan2(y, x);
    const angleDegrees = normalizeAngle(toDegrees(bearingRadians));
    const { directionAr, directionEn } = getDirectionNames(angleDegrees);
    return { angleDegrees, bearingRadians, directionAr, directionEn };
}
function calculateQibla(latitude, longitude) {
    if (latitude < -90 || latitude > 90) {
        throw new errors_1.AppError('Latitude must be between -90 and 90', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    if (longitude < -180 || longitude > 180) {
        throw new errors_1.AppError('Longitude must be between -180 and 180', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const result = calculateQiblaDirection(latitude, longitude);
    return {
        ...result,
        bearingDegrees: result.angleDegrees,
        userLatitude: latitude,
        userLongitude: longitude,
        kaabaLatitude: KAABA_LATITUDE,
        kaabaLongitude: KAABA_LONGITUDE,
    };
}
async function getMyQibla(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            latitude: true,
            longitude: true,
        },
    });
    if (!user) {
        throw new errors_1.AppError('User not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    if (user.latitude === null || user.longitude === null) {
        throw new errors_1.AppError('User location not set. Please set your location first.', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const result = calculateQiblaDirection(user.latitude, user.longitude);
    return {
        ...result,
        bearingDegrees: result.angleDegrees,
        userLatitude: user.latitude,
        userLongitude: user.longitude,
        kaabaLatitude: KAABA_LATITUDE,
        kaabaLongitude: KAABA_LONGITUDE,
    };
}
//# sourceMappingURL=qibla.service.js.map