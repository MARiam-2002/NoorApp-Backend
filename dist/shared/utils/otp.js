"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = generateOtp;
exports.generateOtpExpiry = generateOtpExpiry;
exports.isOtpExpired = isOtpExpired;
const node_crypto_1 = require("node:crypto");
function generateOtp(length = 6) {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return String((0, node_crypto_1.randomInt)(min, max + 1));
}
function generateOtpExpiry(minutes = 10) {
    return new Date(Date.now() + minutes * 60 * 1000);
}
function isOtpExpired(expiresAt) {
    return expiresAt.getTime() < Date.now();
}
//# sourceMappingURL=otp.js.map