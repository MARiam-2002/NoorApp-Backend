/**
 * «سكينة»: public, read-only and nothing about the user is stored (which feeling someone opens is never logged).
 */
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { ADHKAR_CATALOG_ITEMS } from '../shared/data/adhkar-catalog';
import { SAKINA_HADITH, SAKINA_MOODS, SAKINA_VERSION, type SakinaMood } from '../shared/data/sakina';

const ayatDto = (m: SakinaMood) => m.ayat.map(({ surah, from, to }) => ({
  surah, fromAyah: from, toAyah: to, verseKey: `${surah}:${from}`, toVerseKey: `${surah}:${to}`,
}));

function adhkarDto(m: SakinaMood) {
  return m.adhkar.map(({ category, order }) => {
    const item = ADHKAR_CATALOG_ITEMS[category].find((x) => x.orderInCategory === order);
    if (!item) throw new Error(`Sakina ${m.id}: adhkar ${category}/${order} is missing from the catalog`);
    return { category, orderInCategory: order, textAr: item.textAr, repeatCount: item.repeatCount, referenceAr: item.referenceAr, benefitAr: item.benefitAr };
  });
}

const hadithDto = (m: SakinaMood) => m.hadith.map((id) => {
  const h = SAKINA_HADITH[id];
  if (!h) throw new Error(`Sakina ${m.id}: unknown hadith ${id}`);
  const { leadAr, textAr, referenceAr } = h;
  return { id, leadAr, textAr, referenceAr };
});

const summary = (m: SakinaMood) => ({
  id: m.id, titleAr: m.titleAr, titleEn: m.titleEn, feelingAr: m.feelingAr, feelingEn: m.feelingEn, iconKey: m.iconKey,
  counts: { ayat: m.ayat.length, adhkar: m.adhkar.length, hadith: m.hadith.length },
});

export function getSakinaMoods() {
  return { version: SAKINA_VERSION, moods: SAKINA_MOODS.map(summary) };
}

export function getSakinaMood(id: string) {
  const m = SAKINA_MOODS.find((x) => x.id === id);
  if (!m) throw new AppError('Unknown feeling', 404, ErrorCodes.NOT_FOUND);
  return { version: SAKINA_VERSION, ...summary(m), ayat: ayatDto(m), adhkar: adhkarDto(m), hadith: hadithDto(m) };
}

/** Everything in one response, for offline caching (about 25 KB). */
export function getSakinaAll() {
  return { version: SAKINA_VERSION, moods: SAKINA_MOODS.map((m) => getSakinaMood(m.id)).map(({ version: _v, ...rest }) => rest) };
}
