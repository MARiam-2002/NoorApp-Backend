"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listQuerySchema = exports.filteringSchema = void 0;
const zod_1 = require("zod");
const pagination_schema_1 = require("./pagination.schema");
const sorting_schema_1 = require("./sorting.schema");
exports.filteringSchema = zod_1.z.object({
    search: zod_1.z.string().trim().optional(),
    status: zod_1.z.string().trim().optional(),
    category: zod_1.z.string().trim().optional(),
});
exports.listQuerySchema = pagination_schema_1.paginationSchema.merge(sorting_schema_1.sortingSchema).merge(exports.filteringSchema);
//# sourceMappingURL=filtering.schema.js.map