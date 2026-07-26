"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validate = validate;
exports.validator = validate;
function applyValidatedData(req, property, data) {
    if (property === 'body') {
        req.body = data;
        return;
    }
    Object.assign(req[property], data);
}
/**
 * Reusable Zod validation middleware for request data.
 */
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
//# sourceMappingURL=validator.js.map