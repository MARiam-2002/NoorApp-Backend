/**
 * One call for the Quran tab: where to continue reading, today's khatmah ward, today's memorization and the
 * hub sections in display order. Each part fails on its own (null + reason) so the tab always opens.
 */
import { logger } from '../lib/logger';
import { getMushafPreference, getMushafReaderState } from './mushaf.service';
import { getKhatmahWithStats } from './quran.service';
import { getHifzToday } from './hifz.service';
import { listReciters } from './quran.service';

export const QURAN_HUB_SECTIONS = [
  { key: 'MUSHAF', titleAr: 'المصحف', titleEn: 'Mushaf', subtitleAr: 'تابع القراءة من حيث توقفت', icon: 'menu_book', route: '/quran/mushaf' },
  { key: 'LISTEN', titleAr: 'الاستماع', titleEn: 'Listen', subtitleAr: 'قرّاء كثيرون مع تكرار الآية والمقطع', icon: 'headphones', route: '/quran/listen' },
  { key: 'HIFZ', titleAr: 'الحفظ', titleEn: 'Memorize', subtitleAr: 'ورد يومي ومراجعة ذكية واختبار', icon: 'psychology', route: '/quran/hifz' },
  { key: 'TAFSIR', titleAr: 'التفسير', titleEn: 'Tafsir', subtitleAr: 'الميسر والسعدي وابن كثير وغيرها', icon: 'auto_stories', route: '/quran/tafsir' },
  { key: 'KHATMAH', titleAr: 'ختمتي', titleEn: 'Khatmah', subtitleAr: 'خطة الختمة وورد اليوم', icon: 'flag', route: '/quran/khatmah' },
  { key: 'SEARCH', titleAr: 'البحث', titleEn: 'Search', subtitleAr: 'بالكلمة أو بالصوت', icon: 'search', route: '/quran/search' },
  { key: 'SAVED', titleAr: 'المحفوظات والملاحظات', titleEn: 'Saved & notes', subtitleAr: 'الآيات المحفوظة وملاحظاتك', icon: 'bookmark', route: '/quran/saved' },
] as const;

async function part<T>(name: string, run: () => Promise<T>): Promise<{ data: T | null; error: string | null }> {
  try { return { data: await run(), error: null }; }
  catch (error) {
    logger.warn('[QuranHome] part unavailable', { part: name, message: (error as Error)?.message });
    return { data: null, error: 'UNAVAILABLE' };
  }
}

export async function getQuranHome(userId: string) {
  const [reading, khatmah, hifz] = await Promise.all([
    part('reading', async () => {
      const pref = await getMushafPreference(userId);
      const state = await getMushafReaderState(userId, pref.editionId);
      return { editionId: pref.editionId, page: state.page, verseKey: state.verseKey };
    }),
    part('khatmah', async () => {
      const k: any = await getKhatmahWithStats(userId);
      return { dailyGoal: k.dailyGoal, streakDays: k.streakDays, totalPagesRead: k.totalPagesRead, completedKhatmahCount: k.completedKhatmahCount,
        currentPage: k.currentPage ?? null, planActive: Boolean(k.plan?.active) };
    }),
    part('hifz', async () => {
      const t = await getHifzToday(userId);
      return { hasPlan: Boolean(t.plan), status: t.plan?.status ?? null, newPortion: t.newPortion, newDoneToday: t.newDoneToday,
        reviewsDueTotal: t.reviewsDueTotal, planComplete: t.planComplete };
    }),
  ]);
  return {
    sections: QURAN_HUB_SECTIONS,
    continueReading: reading.data, khatmah: khatmah.data, hifz: hifz.data,
    unavailable: [reading.error && 'continueReading', khatmah.error && 'khatmah', hifz.error && 'hifz'].filter(Boolean),
    recitersCount: (await listReciters()).length,
  };
}
