/**
 * Hajj and Umrah guide (public, read-only). Progress (counters, ticked steps) stays on the device.
 */
import { dayKeyForHijri, daysBetween, hijriOfDayKey, DHUL_HIJJAH_MONTH } from '../shared/utils/hijri';
import {
  HAJJ_GUIDE_VERSION, HAJJ_HADITH, HAJJ_NOTICE_AR, HAJJ_NOTICE_EN, HAJJ_STEPS, HAJJ_VIRTUES, IHRAM_INFO, MAWAQIT, UMRAH_STEPS,
  type HajjEvidence, type HajjStep,
} from '../shared/data/hajj-umrah';

export function evidenceDto(e: HajjEvidence) {
  if (e.kind === 'ayah') return { kind: 'ayah' as const, surah: e.surah, fromAyah: e.from, toAyah: e.to, verseKey: `${e.surah}:${e.from}`, toVerseKey: `${e.surah}:${e.to}` };
  const h = HAJJ_HADITH[e.id];
  if (!h) throw new Error(`Hajj guide: unknown hadith ${e.id}`);
  return { kind: 'hadith' as const, id: h.id, leadAr: h.leadAr, textAr: h.textAr, referenceAr: h.referenceAr };
}

const stepDto = (s: HajjStep) => ({
  id: s.id, titleAr: s.titleAr, titleEn: s.titleEn, summaryAr: s.summaryAr, pointsAr: s.pointsAr,
  counter: s.counter ?? null, dhulHijjahDays: s.dhulHijjahDays ?? null, related: s.related ?? [],
  evidence: s.evidence.map(evidenceDto),
});

let cached: ReturnType<typeof build> | null = null;
function build() {
  return {
    version: HAJJ_GUIDE_VERSION,
    noticeAr: HAJJ_NOTICE_AR,
    noticeEn: HAJJ_NOTICE_EN,
    umrah: UMRAH_STEPS.map(stepDto),
    hajj: HAJJ_STEPS.map(stepDto),
    ihram: {
      mawaqit: MAWAQIT,
      miqatPointsAr: IHRAM_INFO.miqatPointsAr,
      miqatEvidence: IHRAM_INFO.miqatEvidence.map(evidenceDto),
      prohibitionsAr: IHRAM_INFO.prohibitionsAr,
      prohibitionsEvidence: IHRAM_INFO.prohibitionsEvidence.map(evidenceDto),
      types: IHRAM_INFO.types,
      typesEvidence: IHRAM_INFO.typesEvidence.map(evidenceDto),
    },
    virtues: HAJJ_VIRTUES.map(evidenceDto),
  };
}
export function getHajjGuide() {
  return (cached ??= build());
}

/**
 * Where the calendar stands for Hajj on a local day:
 * - HAJJ_DAYS (8–13 Dhu al-Hijjah): the steps of that day;
 * - TEN_DAYS (1–7 Dhu al-Hijjah) and SEASON (Shawwal, Dhu al-Qa'dah): countdown to Arafah;
 * - OFF_SEASON: date of the next Arafah. Umrah is open all year and is not part of this.
 */
export function getHajjToday(dayKey: string, hijriOffset = 0) {
  const hijri = hijriOfDayKey(dayKey, hijriOffset);
  const arafahYear = hijri.month === DHUL_HIJJAH_MONTH && hijri.day > 13 ? hijri.year + 1 : hijri.year;
  const arafahDayKey = dayKeyForHijri({ year: arafahYear, month: DHUL_HIJJAH_MONTH, day: 9 }, hijriOffset);
  const daysUntilArafah = arafahDayKey ? daysBetween(dayKey, arafahDayKey) : null;
  let phase: 'HAJJ_DAYS' | 'TEN_DAYS' | 'SEASON' | 'OFF_SEASON' = 'OFF_SEASON';
  let stepIds: string[] = [];
  if (hijri.month === DHUL_HIJJAH_MONTH && hijri.day >= 8 && hijri.day <= 13) {
    phase = 'HAJJ_DAYS';
    stepIds = HAJJ_STEPS.filter((s) => s.dhulHijjahDays?.includes(hijri.day)).map((s) => s.id);
  } else if (hijri.month === DHUL_HIJJAH_MONTH && hijri.day <= 7) phase = 'TEN_DAYS';
  else if (hijri.month === 10 || hijri.month === 11) phase = 'SEASON';
  return { date: dayKey, hijri, hijriOffset, phase, stepIds, arafahDate: arafahDayKey, daysUntilArafah: daysUntilArafah !== null && daysUntilArafah >= 0 ? daysUntilArafah : null };
}
