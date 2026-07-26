"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerOrder = exports.PrayerNameEnum = exports.DefaultTimezone = void 0;
exports.DefaultTimezone = 'Africa/Cairo';
var PrayerNameEnum;
(function (PrayerNameEnum) {
    PrayerNameEnum["FAJR"] = "FAJR";
    PrayerNameEnum["DHUHR"] = "DHUHR";
    PrayerNameEnum["ASR"] = "ASR";
    PrayerNameEnum["MAGHRIB"] = "MAGHRIB";
    PrayerNameEnum["ISHA"] = "ISHA";
})(PrayerNameEnum || (exports.PrayerNameEnum = PrayerNameEnum = {}));
exports.PrayerOrder = [
    PrayerNameEnum.FAJR,
    PrayerNameEnum.DHUHR,
    PrayerNameEnum.ASR,
    PrayerNameEnum.MAGHRIB,
    PrayerNameEnum.ISHA,
];
//# sourceMappingURL=constants.js.map