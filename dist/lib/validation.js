"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.passwordFieldSchema = void 0;
exports.validate = validate;
const zod_1 = require("zod");
exports.passwordFieldSchema = zod_1.z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters')
    .regex(/^(?=.*[A-Za-z])(?=.*\d).+$/, 'Password must contain at least one letter and one number');
function applyValidatedData(req, property, data) {
    if (property === 'body') {
        req.body = data;
        return;
    }
    Object.assign(req[property], data);
}
function validate(schema, property = 'body') {
    return (req, _res, next) => {
        const result = schema.safeParse(req[property]);
        if (!result.success) {
            next(result.error);
            return;
        }
        applyValidatedData(req, property, result.data);
        next();
    };
}
//# sourceMappingURL=validation.js.map