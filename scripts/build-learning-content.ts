/**
 * Builds src/shared/data/learning-content.ts from scripts/lib/learning/catalog.ts.
 * Every Quran citation is copied verbatim from prisma/data/quran-uthmani.json, every hadith phrase is found in the
 * pinned Sahih al-Bukhari / Sahih Muslim editions under its stated number, and an-Nawawi's Forty are copied
 * verbatim from the pinned edition. Any mismatch, unknown reference or policy violation fails the build.
 *
 *   npx tsx scripts/build-learning-content.ts          # rebuild
 *   npx tsx scripts/build-learning-content.ts --check  # fail if the committed file is out of date
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ayahCount, ayahText } from './lib/quran-lookup';
import { findSahihPhrase, type SahihCollection } from './lib/sahihayn-lookup';
import { LEARNING_CATALOG_VERSION, LEARNING_COLLECTIONS } from './lib/learning/catalog';
import type { ItemDef, QuizDef, SectionDef } from './lib/learning/types';

/**
 * Authors write the correct option first. The build shuffles the options with a permutation derived from the item id
 * and question index, so the right answer is not always first and the output stays the same on every build.
 */
function shuffledQuestion(q: QuizDef, seed: string): QuizDef {
  const order = q.optionsAr.map((_, i) => i)
    .map(i => ({ i, key: createHash('sha256').update(`${seed}:${i}`).digest('hex') }))
    .sort((a, b) => (a.key < b.key ? -1 : 1)).map(x => x.i);
  return { ...q, optionsAr: order.map(i => q.optionsAr[i]!), correctIndex: order.indexOf(q.correctIndex) };
}
import { CATALOG_SURAHS } from '../src/data/surahs';

const OUT = join(process.cwd(), 'src', 'shared', 'data', 'learning-content.ts');

/** Pinned source files: content is rebuilt only from these exact bytes. */
const PINNED: Record<string, string> = {
  'prisma/data/quran-uthmani.json': '3f71fc5ad4dd7f9f9cc5fa1766e36eb26f5eb2da32aea9055828a21919bd9731',
  'prisma/data/hadith/ara-bukhari.json': 'e34a3402889ca378871da3c5984b7875c680920e93f1c8738ac7afe502179562',
  'prisma/data/hadith/ara-muslim.json': '194073b24090c5368e4d14a3f55c9e0ef144c7437bd7e5aa83aa4d2bc54a8ea0',
  'prisma/data/hadith/eng-muslim.json': '2ef51a2a1980fb91e395fbf1580cc9c9413297f54bb8cad271e1499417299488',
  'prisma/data/hadith/ara-nawawi.json': '91f559b90422005b768bb449426d87d2e6fabbb43ac3a31e5c24c50ca77465e6',
};
for (const [file, sha] of Object.entries(PINNED)) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) throw new Error(`Missing source ${file}. Download it from fawazahmed0/hadith-api (editions/) or the Quran data step.`);
  const actual = createHash('sha256').update(readFileSync(path)).digest('hex');
  if (actual !== sha) throw new Error(`Source ${file} changed: sha256 ${actual}, expected ${sha}`);
}

/** Retellings must stay inside the cited sources: phrases that usually introduce unsourced narration are refused. */
const FORBIDDEN_NARRATIVE = ['زليخا', 'يقال إن', 'يُقال إن', 'روي أن', 'رُوي أن', 'قيل إن', 'قيل إنه', 'الإسرائيليات', 'تقول الروايات', 'في الأثر'];

const AR_DIGITS = (n: number) => String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));
const plainSurahName = (surah: number) => {
  const row = CATALOG_SURAHS.find(s => s.id === surah);
  if (!row) throw new Error(`Unknown surah ${surah}`);
  return row.nameAr.replace(/[ً-ٰٟۖ-ۭ]/g, '').replace(/ٱ/g, 'ا');
};
const COLLECTION_AR: Record<SahihCollection, string> = { bukhari: 'صحيح البخاري', muslim: 'صحيح مسلم' };
const RAWAHU: Record<SahihCollection, string> = { bukhari: 'رواه البخاري', muslim: 'رواه مسلم' };
const cleanExcerpt = (text: string) => text.replace(/[‏‎"]/g, '').replace(/\s+/g, ' ').replace(/^[\s،,.:ـ]+|[\s،,.:ـ]+$/g, '').trim();

const nawawi = (JSON.parse(readFileSync(join(process.cwd(), 'prisma/data/hadith/ara-nawawi.json'), 'utf8')) as { hadiths: { hadithnumber: number; text: string }[] }).hadiths;
const nawawiText = (n: number) => {
  const h = nawawi.find(x => x.hadithnumber === n);
  if (!h?.text) throw new Error(`An-Nawawi hadith ${n} not found`);
  return h.text.replace(/<br\s*\/?>/gi, '\n').replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
};

function buildSection(itemId: string, s: SectionDef, index: number) {
  const where = `${itemId} section ${index + 1}`;
  const quranRefs = s.quran ?? [], hadithRefs = s.hadith ?? [], nawawiRefs = s.nawawi ?? [];
  if (!s.titleAr.trim()) throw new Error(`${where}: empty title`);
  if (quranRefs.length + hadithRefs.length + nawawiRefs.length === 0) throw new Error(`${where}: every section needs a Quran or hadith citation`);
  if (!nawawiRefs.length && !s.paragraphsAr.some(p => p.trim())) throw new Error(`${where}: empty text`);
  for (const text of [...s.paragraphsAr, s.reflectionAr ?? '']) {
    const bad = FORBIDDEN_NARRATIVE.find(w => text.includes(w));
    if (bad) throw new Error(`${where}: unsourced-narration marker «${bad}»`);
  }
  const quran = quranRefs.map(r => {
    const to = r.to ?? r.from;
    if (r.from < 1 || to < r.from || to > ayahCount(r.surah)) throw new Error(`${where}: bad range ${r.surah}:${r.from}-${to}`);
    const verses = [];
    for (let a = r.from; a <= to; a++) verses.push({ verseKey: `${r.surah}:${a}`, ayah: a, textAr: ayahText(r.surah, a) });
    const name = plainSurahName(r.surah);
    return { surah: r.surah, surahNameAr: name, fromAyah: r.from, toAyah: to,
      referenceAr: `${name} ${AR_DIGITS(r.from)}${to > r.from ? '–' + AR_DIGITS(to) : ''}`, verses };
  });
  const hadith: { collection: SahihCollection; collectionAr: string; number: number; excerptsAr: string[]; sourceAr: string }[] = [];
  for (const r of hadithRefs) {
    const match = findSahihPhrase(r.collection, r.phrase).find(m => m.number === r.number);
    if (!match) throw new Error(`${where}: phrase not found in ${r.collection} #${r.number}: «${r.phrase}»`);
    const excerpt = cleanExcerpt(match.excerptAr);
    const same = hadith.find(h => h.collection === r.collection && h.number === r.number);
    if (same) { if (!same.excerptsAr.includes(excerpt)) same.excerptsAr.push(excerpt); continue; }
    hadith.push({ collection: r.collection, collectionAr: COLLECTION_AR[r.collection], number: r.number, excerptsAr: [excerpt],
      sourceAr: `${RAWAHU[r.collection]} — رقم ${AR_DIGITS(r.number)}` });
  }
  const nawawiOut = nawawiRefs.map(n => ({ number: n, textAr: nawawiText(n), sourceAr: `الأربعون النووية — الحديث ${AR_DIGITS(n)}` }));
  return { index, titleAr: s.titleAr, paragraphsAr: s.paragraphsAr, reflectionAr: s.reflectionAr ?? null, quran, hadith, nawawi: nawawiOut };
}

function buildItem(collectionId: string, item: ItemDef) {
  if (!/^[a-z0-9-]+$/.test(item.id)) throw new Error(`Bad id ${item.id}`);
  if (!item.sections.length) throw new Error(`${item.id}: no sections`);
  item.quiz.forEach((q, i) => {
    if (q.optionsAr.length < 2 || q.correctIndex < 0 || q.correctIndex >= q.optionsAr.length) throw new Error(`${item.id} quiz ${i + 1}: bad options`);
    if (new Set(q.optionsAr).size !== q.optionsAr.length) throw new Error(`${item.id} quiz ${i + 1}: duplicate options`);
  });
  if (item.review.status === 'APPROVED' && (!item.review.reviewerAr.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(item.review.approvedAt))) throw new Error(`${item.id}: approval needs reviewer and date`);
  const sections = item.sections.map((s, i) => buildSection(item.id, s, i));
  const words = sections.reduce((n, s) => n + [...s.paragraphsAr, s.reflectionAr ?? ''].join(' ').split(/\s+/).filter(Boolean).length
    + s.quran.reduce((m, q) => m + q.verses.reduce((k, v) => k + v.textAr.split(/\s+/).length, 0), 0), 0);
  return {
    id: item.id, collectionId, order: item.order, titleAr: item.titleAr, titleEn: item.titleEn,
    personAr: item.personAr ?? null, honorificAr: item.honorificAr ?? null, summaryAr: item.summaryAr,
    readingMinutes: Math.max(1, Math.round(words / 150)),
    sections, keyPointsAr: item.keyPointsAr, quiz: item.quiz.map((q, i) => shuffledQuestion(q, `${item.id}:${i}`)),
    review: item.review.status === 'APPROVED'
      ? { status: 'APPROVED' as const, reviewerAr: item.review.reviewerAr, approvedAt: item.review.approvedAt, notesAr: item.review.notesAr ?? null }
      : { status: 'DRAFT' as const, reviewerAr: null, approvedAt: null, notesAr: null },
  };
}

const ids = new Set<string>();
const collections = [...LEARNING_COLLECTIONS].sort((a, b) => a.order - b.order).map(c => {
  if (c.existingEndpoint && c.items.length) throw new Error(`${c.id}: an existing section must not duplicate items`);
  const items = c.items.map(i => { if (ids.has(i.id)) throw new Error(`Duplicate id ${i.id}`); ids.add(i.id); return buildItem(c.id, i); })
    .sort((a, b) => a.order - b.order);
  return { id: c.id, order: c.order, kind: c.kind, existingEndpoint: c.existingEndpoint ?? null, titleAr: c.titleAr, titleEn: c.titleEn,
    descriptionAr: c.descriptionAr, methodAr: c.methodAr, items };
});

const header = `/**
 * Generated by scripts/build-learning-content.ts — do not edit by hand.
 * Edit scripts/lib/learning/*, rebuild, and bump LEARNING_CATALOG_VERSION when published content changes.
 * Quran text: Tanzil Uthmani (prisma/data/quran-uthmani.json). Hadith: fawazahmed0/hadith-api editions (public domain),
 * pinned by SHA-256 in the build script.
 */
`;
const body = `${header}
export const LEARNING_CATALOG_VERSION = ${LEARNING_CATALOG_VERSION};

export const LEARNING_SOURCES_SHA256 = ${JSON.stringify(PINNED, null, 2)} as const;

export type LearningVerse = { verseKey: string; ayah: number; textAr: string };
export type LearningQuranBlock = { surah: number; surahNameAr: string; fromAyah: number; toAyah: number; referenceAr: string; verses: LearningVerse[] };
export type LearningHadithBlock = { collection: 'bukhari' | 'muslim'; collectionAr: string; number: number; excerptsAr: string[]; sourceAr: string };
export type LearningNawawiBlock = { number: number; textAr: string; sourceAr: string };
export type LearningSection = {
  index: number; titleAr: string; paragraphsAr: string[]; reflectionAr: string | null;
  quran: LearningQuranBlock[]; hadith: LearningHadithBlock[]; nawawi: LearningNawawiBlock[];
};
export type LearningQuiz = { questionAr: string; optionsAr: string[]; correctIndex: number; explanationAr: string };
export type LearningItemData = {
  id: string; collectionId: string; order: number; titleAr: string; titleEn: string; personAr: string | null; honorificAr: string | null;
  summaryAr: string; readingMinutes: number; sections: LearningSection[]; keyPointsAr: string[]; quiz: LearningQuiz[];
  review: { status: 'DRAFT' | 'APPROVED'; reviewerAr: string | null; approvedAt: string | null; notesAr: string | null };
};
export type LearningCollectionData = {
  id: string; order: number; kind: 'STORY' | 'LESSON' | 'HADITH'; existingEndpoint: string | null; titleAr: string; titleEn: string;
  descriptionAr: string; methodAr: string; items: LearningItemData[];
};

/** Explicitly typed (not \`as const\`) so the compiler does not have to infer a literal type for every item. */
export const LEARNING_COLLECTIONS_DATA: readonly LearningCollectionData[] = ${JSON.stringify(collections, null, 2)};
`;

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== body) { console.error('learning-content.ts is out of date: run npx tsx scripts/build-learning-content.ts'); process.exit(1); }
  console.log('learning-content.ts is up to date.');
} else {
  writeFileSync(OUT, body);
  const count = collections.reduce((n, c) => n + c.items.length, 0);
  console.log(`Wrote ${OUT}: ${collections.length} collections, ${count} items.`);
}
