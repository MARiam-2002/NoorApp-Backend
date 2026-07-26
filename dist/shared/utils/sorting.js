"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseSortQuery = parseSortQuery;
exports.buildOrderBy = buildOrderBy;
exports.parseMultiSortQuery = parseMultiSortQuery;
const sort_order_enum_1 = require("../enums/sort-order.enum");
function parseSortQuery(sort, allowedFields = ['createdAt', 'updatedAt'], defaultField = 'createdAt') {
    if (!sort) {
        return { field: defaultField, order: sort_order_enum_1.SortOrder.Desc };
    }
    const isDescending = sort.startsWith('-');
    const field = isDescending ? sort.slice(1) : sort;
    if (!allowedFields.includes(field)) {
        return { field: defaultField, order: sort_order_enum_1.SortOrder.Desc };
    }
    return {
        field,
        order: isDescending ? sort_order_enum_1.SortOrder.Desc : sort_order_enum_1.SortOrder.Asc,
    };
}
function buildOrderBy(sort) {
    return { [sort.field]: sort.order };
}
function parseMultiSortQuery(sort, allowedFields = ['createdAt', 'updatedAt']) {
    const sortValues = Array.isArray(sort) ? sort : sort ? [sort] : [];
    if (sortValues.length === 0) {
        return [parseSortQuery(undefined, allowedFields)];
    }
    return sortValues.map((value) => parseSortQuery(value, allowedFields));
}
//# sourceMappingURL=sorting.js.map