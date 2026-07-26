"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cursorPaginationSchema = void 0;
const zod_1 = require("zod");
const cursor_pagination_1 = require("../../utils/cursor-pagination");
exports.cursorPaginationSchema = zod_1.z.object({
    limit: zod_1.z.coerce.number().int().positive().max(cursor_pagination_1.MAX_CURSOR_LIMIT).default(20),
    cursor: zod_1.z.string().optional(),
});
//# sourceMappingURL=cursor-pagination.schema.js.map