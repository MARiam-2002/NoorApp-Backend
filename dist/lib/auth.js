"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashPassword = hashPassword;
exports.verifyPassword = verifyPassword;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.verifyAccessToken = verifyAccessToken;
exports.verifyRefreshToken = verifyRefreshToken;
const bcrypt_1 = __importDefault(require("bcrypt"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const config_1 = require("../config");
async function hashPassword(password) {
    return bcrypt_1.default.hash(password, config_1.env.BCRYPT_SALT_ROUNDS);
}
async function verifyPassword(password, hashedPassword) {
    return bcrypt_1.default.compare(password, hashedPassword);
}
function generateAccessToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.env.JWT_SECRET, { expiresIn: config_1.env.JWT_EXPIRES_IN });
}
function generateRefreshToken(payload) {
    return jsonwebtoken_1.default.sign(payload, config_1.env.JWT_REFRESH_SECRET, { expiresIn: config_1.env.JWT_REFRESH_EXPIRES_IN });
}
function verifyAccessToken(token) {
    return jsonwebtoken_1.default.verify(token, config_1.env.JWT_SECRET);
}
function verifyRefreshToken(token) {
    return jsonwebtoken_1.default.verify(token, config_1.env.JWT_REFRESH_SECRET);
}
//# sourceMappingURL=auth.js.map