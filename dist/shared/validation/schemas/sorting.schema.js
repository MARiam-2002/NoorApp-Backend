"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sortingSchema = void 0;
const zod_1 = require("zod");
exports.sortingSchema = zod_1.z.object({
    sort: zod_1.z.string().optional(),
});
//# sourceMappingURL=sorting.schema.js.map