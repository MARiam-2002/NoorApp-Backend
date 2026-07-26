"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordFieldSchema = void 0;
const zod_1 = require("zod");
exports.passwordFieldSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number');
//# sourceMappingURL=password.schema.js.map