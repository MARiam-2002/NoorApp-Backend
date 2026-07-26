"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Dhikr = void 0;
exports.getDhikrArName = getDhikrArName;
exports.getTodayTasbih = getTodayTasbih;
exports.incrementTasbih = incrementTasbih;
exports.resetTasbih = resetTasbih;
exports.changeDhikr = changeDhikr;
exports.getTasbihHistory = getTasbihHistory;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
function getTodayDateOnly(date = new Date()) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
var Dhikr;
(function (Dhikr) {
    Dhikr["SUBHAN_ALLAH"] = "SUBHAN_ALLAH";
    Dhikr["ALHAMDULILLAH"] = "ALHAMDULILLAH";
    Dhikr["LA_ILAHA_ILLA_ALLAH"] = "LA_ILAHA_ILLA_ALLAH";
    Dhikr["ALLAHU_AKBAR"] = "ALLAHU_AKBAR";
    Dhikr["ASTAGHFIRULLAH"] = "ASTAGHFIRULLAH";
    Dhikr["LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH"] = "LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH";
})(Dhikr || (exports.Dhikr = Dhikr = {}));
const dhikrArNamesMap = {
    [Dhikr.SUBHAN_ALLAH]: 'سبحان الله',
    [Dhikr.ALHAMDULILLAH]: 'الحمد لله',
    [Dhikr.LA_ILAHA_ILLA_ALLAH]: 'لا إله إلا الله',
    [Dhikr.ALLAHU_AKBAR]: 'الله أكبر',
    [Dhikr.ASTAGHFIRULLAH]: 'أستغفر الله',
    [Dhikr.LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH]: 'لا حول ولا قوة إلا بالله',
};
function getDhikrArName(dhikr) {
    const key = dhikr;
    return dhikrArNamesMap[key] ?? dhikr;
}
async function getOrCreateToday(userId, date = getTodayDateOnly()) {
    return prisma_1.prisma.tasbihLog.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
    });
}
async function getTodayTasbih(userId) {
    const tasbihLog = await getOrCreateToday(userId);
    return {
        id: tasbihLog.id,
        date: tasbihLog.date,
        dhikr: tasbihLog.dhikr,
        count: tasbihLog.count,
        totalAllTime: tasbihLog.totalAllTime,
    };
}
async function incrementTasbih(userId, amount = 1) {
    if (amount <= 0) {
        throw new errors_1.AppError('Amount must be greater than zero', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const date = getTodayDateOnly();
    const current = await getOrCreateToday(userId, date);
    const tasbihLog = await prisma_1.prisma.tasbihLog.update({
        where: { id: current.id },
        data: {
            count: current.count + amount,
            totalAllTime: current.totalAllTime + amount,
        },
    });
    return {
        id: tasbihLog.id,
        dhikr: tasbihLog.dhikr,
        count: tasbihLog.count,
        totalAllTime: tasbihLog.totalAllTime,
    };
}
async function resetTasbih(userId) {
    const date = getTodayDateOnly();
    const current = await getOrCreateToday(userId, date);
    // TODO: After running "npx prisma migrate dev", uncomment to save reset history
    // if (current.count > 0) {
    //   await prisma.tasbihResetHistory.create({
    //     data: {
    //       userId,
    //       tasbihLogId: current.id,
    //       countBeforeReset: current.count,
    //       date: new Date(),
    //     },
    //   });
    // }
    const tasbihLog = await prisma_1.prisma.tasbihLog.update({
        where: { id: current.id },
        data: { count: 0 },
    });
    return {
        id: tasbihLog.id,
        dhikr: tasbihLog.dhikr,
        count: tasbihLog.count,
        totalAllTime: tasbihLog.totalAllTime,
    };
}
async function changeDhikr(userId, dhikr) {
    const date = getTodayDateOnly();
    const tasbihLog = await prisma_1.prisma.tasbihLog.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, dhikr },
        update: { dhikr },
    });
    return {
        id: tasbihLog.id,
        dhikr: tasbihLog.dhikr,
        count: tasbihLog.count,
        totalAllTime: tasbihLog.totalAllTime,
    };
}
async function getTasbihHistory(userId, limit = 30) {
    if (limit <= 0) {
        throw new errors_1.AppError('Limit must be greater than zero', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const history = await prisma_1.prisma.tasbihLog.findMany({
        where: { userId },
        orderBy: { date: 'desc' },
        take: limit,
    });
    return history.map((log) => ({
        id: log.id,
        date: log.date,
        dhikr: log.dhikr,
        count: log.count,
        totalAllTime: log.totalAllTime,
    }));
}
//# sourceMappingURL=tasbih.service.js.map