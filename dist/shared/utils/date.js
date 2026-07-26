"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toIsoDate = toIsoDate;
exports.startOfDay = startOfDay;
exports.endOfDay = endOfDay;
exports.addDays = addDays;
exports.isExpired = isExpired;
exports.formatDate = formatDate;
function toIsoDate(date = new Date()) {
    return date.toISOString();
}
function startOfDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
}
function endOfDay(date = new Date()) {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
}
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}
function isExpired(date) {
    return date.getTime() < Date.now();
}
function formatDate(date, locale = 'ar-EG') {
    return new Intl.DateTimeFormat(locale, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(date);
}
//# sourceMappingURL=date.js.map