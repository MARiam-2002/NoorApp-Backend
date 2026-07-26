"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateRandomToken = generateRandomToken;
exports.hashValue = hashValue;
exports.verifyHash = verifyHash;
exports.sha256 = sha256;
const node_crypto_1 = require("node:crypto");
function generateRandomToken(bytes = 32) {
    return (0, node_crypto_1.randomBytes)(bytes).toString('hex');
}
function hashValue(value, salt) {
    const resolvedSalt = salt ?? (0, node_crypto_1.randomBytes)(16).toString('hex');
    const hash = (0, node_crypto_1.scryptSync)(value, resolvedSalt, 64).toString('hex');
    return { hash, salt: resolvedSalt };
}
function verifyHash(value, hash, salt) {
    const derivedHash = (0, node_crypto_1.scryptSync)(value, salt, 64);
    const storedHash = Buffer.from(hash, 'hex');
    if (derivedHash.length !== storedHash.length) {
        return false;
    }
    return (0, node_crypto_1.timingSafeEqual)(derivedHash, storedHash);
}
function sha256(value) {
    return (0, node_crypto_1.scryptSync)(value, 'noor-static-salt', 32).toString('hex');
}
//# sourceMappingURL=crypto.js.map