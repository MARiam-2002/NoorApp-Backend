"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDayOfYear = getDayOfYear;
exports.getTodayDateOnly = getTodayDateOnly;
function getDayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}
function getTodayDateOnly(date = new Date()) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
//# sourceMappingURL=date.js.map