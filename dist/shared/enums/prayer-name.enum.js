"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrayerOrder = exports.PrayerLabelsAr = exports.PrayerNameEnum = void 0;
var PrayerNameEnum;
(function (PrayerNameEnum) {
    PrayerNameEnum["FAJR"] = "FAJR";
    PrayerNameEnum["DHUHR"] = "DHUHR";
    PrayerNameEnum["ASR"] = "ASR";
    PrayerNameEnum["MAGHRIB"] = "MAGHRIB";
    PrayerNameEnum["ISHA"] = "ISHA";
})(PrayerNameEnum || (exports.PrayerNameEnum = PrayerNameEnum = {}));
exports.PrayerLabelsAr = {
    [PrayerNameEnum.FAJR]: 'الفجر',
    [PrayerNameEnum.DHUHR]: 'الظهر',
    [PrayerNameEnum.ASR]: 'العصر',
    [PrayerNameEnum.MAGHRIB]: 'المغرب',
    [PrayerNameEnum.ISHA]: 'العشاء',
};
exports.PrayerOrder = [
    PrayerNameEnum.FAJR,
    PrayerNameEnum.DHUHR,
    PrayerNameEnum.ASR,
    PrayerNameEnum.MAGHRIB,
    PrayerNameEnum.ISHA,
];
//# sourceMappingURL=prayer-name.enum.js.map