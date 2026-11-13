/**
 * Builds src/shared/data/fiqh-course.ts — «الفقه الميسر» course (Learning → courses) from the منصة يَسِّر snapshot
 * (scripts/data/fiqh-muyassar/source, used with the author's permission) and Noor's editorial layer:
 *   - matn-fixes.ts   corrections of the matn checked against the printed book's pages
 *   - edits-0*.ts     edited explanations of lessons 1–50 (verified hadith blocks, review notes)
 *   - expl-fixes.ts   targeted corrections in lessons 51–89
 *   - glossary-fixes.ts
 * Every hadith block is checked letter and vowel by scripts/test-fiqh-course.ts; quotes attributed to the Prophet ﷺ
 * inside the running text are looked up in Sahih al-Bukhari, Sahih Muslim, Abu Dawud and al-Tirmidhi: found ones get
 * their reference, the others are listed for review (FIQH_REVIEW_NOTES, never sent to the app).
 *
 *   npx tsx scripts/build-fiqh-course.ts          # rebuild
 *   npx tsx scripts/build-fiqh-course.ts --check  # fail if the committed file is out of date
 */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { findSahihPhrase, tirmidhiGrades, type SahihCollection } from './lib/sahihayn-lookup';
import { MATN_FIXES } from './data/fiqh-muyassar/matn-fixes';
import { EXPL_FIXES } from './data/fiqh-muyassar/expl-fixes';
import { EDITS_01 } from './data/fiqh-muyassar/edits-01';
import { EDITS_02 } from './data/fiqh-muyassar/edits-02';
import { EDITS_03 } from './data/fiqh-muyassar/edits-03';
import { FIQH_HADITH } from './data/fiqh-muyassar/hadith';
import { GLOSSARY_FIXES } from './data/fiqh-muyassar/glossary-fixes';
import type { FiqhEdit } from './data/fiqh-muyassar/types';

const DIR = join(process.cwd(), 'scripts', 'data', 'fiqh-muyassar', 'source');
const OUT = join(process.cwd(), 'src', 'shared', 'data', 'fiqh-course.ts');
const PINNED: Record<string, string> = {
  'lessons.json': '10737fa166059cc78f1b67fc10b94ff5e8f60549d2c438f8eec0f807a6102488',
  'glossary.json': '6d3b717d322705977ded02a541862ed73195d84564c38ee6787250a5bba310e7',
};
for (const [f, sha] of Object.entries(PINNED)) {
  const got = createHash('sha256').update(readFileSync(join(DIR, f))).digest('hex');
  if (got !== sha) throw new Error(`${f} changed (sha256 ${got}); review the new snapshot and update PINNED`);
}

export const FIQH_COURSE_VERSION = 1;
const BOOKS = ['كتاب الطهارة', 'كتاب الصلاة', 'كتاب الزكاة', 'كتاب الصيام', 'كتاب الحج', 'كتاب الجهاد', 'كتاب المعاملات',
  'كتاب المواريث والوصايا والعتق', 'كتاب النكاح والطلاق', 'كتاب الجنايات', 'كتاب الحدود', 'كتاب الأيمان والنذور',
  'كتاب الأطعمة والذبائح والصيد', 'كتاب القضاء والشهادات'];

type Src = { id: number; bookName: string; chapterName: string; title: string; mainText: string; sheikhExplanation: string;
  videoUrl: string; startTime: string; endTime: string; videoNumber: string; pageNumber: string };
const SRC = JSON.parse(readFileSync(join(DIR, 'lessons.json'), 'utf8')) as Src[];
const GLOSSARY_SRC = JSON.parse(readFileSync(join(DIR, 'glossary.json'), 'utf8')) as Record<string, string>;
const EDITS: Record<number, FiqhEdit> = { ...EDITS_01, ...EDITS_02, ...EDITS_03 };

const REVIEW: Record<number, string[]> = {};
const note = (id: number, s: string) => (REVIEW[id] ??= []).push(s);

function applyFixes(id: number, text: string, fixes: ([string, string] | [string, string, 'all'])[] | undefined, what: string) {
  let t = text;
  for (const f of fixes ?? []) {
    const n = t.split(f[0]).length - 1;
    if (n === 0) throw new Error(`lesson ${id} ${what}: «${f[0].slice(0, 60)}» not found`);
    if (n > 1 && f[2] !== 'all') throw new Error(`lesson ${id} ${what}: «${f[0].slice(0, 60)}» found ${n} times`);
    t = t.split(f[0]).join(f[1]);
  }
  return t;
}

const NO_ADDITION = /^\s*(?:هذه\s+)?(?:المسأل[هة]|المسال[هة])?\s*صحيح[هة](?:\s|$)[^\n]{0,90}$/;
const normalizeSalla = (t: string) => t.replace(/\s*[-–]?\s*صل[ىي] الله علي[هة] و\s?سلم\s*[-–]?/g, ' ﷺ').replace(/ ﷺ([،.:؛)])/g, ' ﷺ$1');

const clean = (t: string) => t.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
const cleanTitle = (t: string) => t.replace(/^لمسألة/, 'المسألة').replace(/^المسالة/, 'المسألة').replace(/الاولي|الأولي/, 'الأولى')
  .replace(/الثانيه/, 'الثانية').replace(/\s*:\s*$/, '').replace(/\s+:/g, ':').replace(/\s+/g, ' ').trim();
const cleanChapter = (t: string) => t.replace(/\s*[,،]?\s*وفيه (?:عدة )?مسائل\s*:?\s*$/, '').replace(/\s*[:.]\s*$/, '').replace(/\s+:/g, ':').replace(/\s+/g, ' ').trim();

type Block =
  | { type: 'heading'; text: string } | { type: 'paragraph'; text: string } | { type: 'bullet'; text: string }
  | { type: 'numbered'; n: string; text: string } | { type: 'divider' }
  | { type: 'hadith'; id: string; leadAr: string; textAr: string; referenceAr: string }
  | { type: 'ayah'; surah: number; fromAyah: number; toAyah: number; verseKey: string; toVerseKey: string };

function parseBlocks(id: number, text: string): Block[] {
  const out: Block[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(\*{3,}|-{3,})$/.test(line)) { if (out.length && out[out.length - 1].type !== 'divider') out.push({ type: 'divider' }); continue; }
    let m = line.match(/^@hadith:([A-Za-z0-9]+)$/);
    if (m) {
      const h = FIQH_HADITH[m[1]];
      if (!h) throw new Error(`lesson ${id}: unknown hadith ${m[1]}`);
      out.push({ type: 'hadith', id: m[1], leadAr: h.leadAr, textAr: h.textAr, referenceAr: h.referenceAr });
      continue;
    }
    m = line.match(/^@ayah:(\d+):(\d+)(?:-(\d+))?$/);
    if (m) {
      const surah = Number(m[1]), from = Number(m[2]), to = Number(m[3] ?? m[2]);
      out.push({ type: 'ayah', surah, fromAyah: from, toAyah: to, verseKey: `${surah}:${from}`, toVerseKey: `${surah}:${to}` });
      continue;
    }
    m = line.match(/^(?:-{1,2}|•)\s+(.*)$/);
    if (m) { out.push({ type: 'bullet', text: m[1] }); continue; }
    m = line.match(/^([0-9٠-٩]+)\s*[-.)]\s*(.*)$/);
    if (m && m[2]) { out.push({ type: 'numbered', n: m[1], text: m[2] }); continue; }
    if (line.length <= 48 && !/[.:؛،؟!»)]$/.test(line) && !/[.،؛]/.test(line) && line.split(/\s+/).length <= 9) { out.push({ type: 'heading', text: line }); continue; }
    out.push({ type: 'paragraph', text: line });
  }
  while (out.length && out[out.length - 1].type === 'divider') out.pop();
  return out;
}

const COLL_AR: Record<SahihCollection, string> = { bukhari: 'رواه البخاري', muslim: 'رواه مسلم', abudawud: 'رواه أبو داود', tirmidhi: 'رواه الترمذي' };
const PROPHETIC = /(ﷺ|قال|قوله|حديث|رضي الله عن)[^«»]{0,45}$/;
function citations(id: number, blocks: Block[]) {
  const found: { quoteAr: string; referenceAr: string }[] = [];
  for (const b of blocks) {
    if (!('text' in b) || b.type === 'heading') continue;
    for (const m of b.text.matchAll(/«([^«»]{8,600})»/g)) {
      const before = b.text.slice(0, m.index);
      if (!PROPHETIC.test(before)) continue;
      const q = m[1].replace(/\.\.\.|…/g, ' ').replace(/\s*[-–]\s*أي[^-–]*[-–]\s*/g, ' ').trim();
      if (q.split(/\s+/).length < 4) continue;
      let ref: string | null = null;
      const words = q.replace(/ﷺ/g, 'صلى الله عليه وسلم').split(/\s+/).filter(w => /[\u0621-\u064A]/.test(w));
      for (const c of ['bukhari', 'muslim', 'abudawud', 'tirmidhi'] as SahihCollection[]) {
        let hit = findSahihPhrase(c, words.join(' '));
        let partial = false;
        if (!hit.length && words.length > 8) { hit = findSahihPhrase(c, words.slice(0, 8).join(' ')); partial = hit.length > 0; }
        if (!hit.length) continue;
        if (partial) note(id, `«${m[1].slice(0, 70)}…»: أوله في ${COLL_AR[c].replace('رواه ', '')} (${hit[0].number})، وباقي اللفظ يُراجع على المصدر.`);
        const n = hit[0].number;
        if (c === 'abudawud' || c === 'tirmidhi') {
          const g = tirmidhiGrades(n, c)['Al-Albani'] ?? '';
          const grade = g === 'Hasan Sahih' ? 'وقال الألباني: حسن صحيح' : /^Sahih/.test(g) ? 'وصححه الألباني' : /^Hasan/.test(g) ? 'وحسّنه الألباني' : 'وضعّفه الألباني';
          if (grade === 'وضعّفه الألباني') note(id, `«${q.slice(0, 80)}…»: ${COLL_AR[c]} (${n}) وضعّفه الألباني.`);
          ref = `${COLL_AR[c]} (${n})، ${grade}`;
        } else ref = `${COLL_AR[c]} (${n})`;
        break;
      }
      if (ref) found.push({ quoteAr: m[1].length > 120 ? `${m[1].slice(0, 117)}…` : m[1], referenceAr: ref });
      else note(id, `لم يُعثر على لفظ «${m[1].slice(0, 90)}» في الصحيحين وأبي داود والترمذي؛ يُراجع تخريجه.`);
    }
  }
  return found;
}

const seconds = (t: string) => {
  if (!(t || '').trim()) return null;
  const p = t.trim().split(':').map(Number);
  if (!p.length || p.some(Number.isNaN) || p.length > 3) return null;
  return p.reduce((acc, v) => acc * 60 + v, 0);
};
const youtubeId = (u: string) => u.match(/(?:youtu\.be\/|v=)([A-Za-z0-9_-]{11})/)?.[1] ?? null;

const lessons = SRC.map((s, i) => {
  const id = s.id;
  const matn = clean(applyFixes(id, s.mainText, MATN_FIXES[id], 'matn'));
  const edit = EDITS[id];
  let explanationText: string | null;
  if (edit) {
    explanationText = edit.explanation === null ? null : clean(edit.explanation);
    for (const r of edit.reviewAr ?? []) note(id, r);
  } else {
    const fixed = clean(normalizeSalla(applyFixes(id, s.sheikhExplanation, EXPL_FIXES[id], 'explanation')));
    explanationText = NO_ADDITION.test(fixed) || /^لم يزد عليها/.test(fixed) ? null : fixed;
  }
  const blocks = explanationText ? parseBlocks(id, explanationText) : [];
  const vid = youtubeId(s.videoUrl);
  const start = seconds(s.startTime);
  const next = SRC.slice(i + 1).find(x => youtubeId(x.videoUrl) === vid);
  const end = seconds(s.endTime) ?? (next ? seconds(next.startTime) : null);
  return {
    id, order: i + 1,
    book: s.bookName.trim(), chapter: cleanChapter(s.chapterName), title: cleanTitle(s.title),
    printedPage: Number(s.pageNumber) || null,
    matnAr: matn,
    explanation: blocks,
    citations: citations(id, blocks),
    video: vid ? { youtubeId: vid, url: `https://youtu.be/${vid}?t=${start ?? 0}`, startSeconds: start, endSeconds: end && start !== null && end > start ? end : null,
      lessonLabelAr: s.videoNumber.trim() } : null,
  };
});

const glossary = Object.entries({ ...GLOSSARY_SRC, ...GLOSSARY_FIXES })
  .filter(([term]) => term in GLOSSARY_SRC)
  .map(([term, definition]) => ({ term: term.trim(), definitionAr: definition.trim() }))
  .sort((a, b) => b.term.length - a.term.length); // longest first, so the app can highlight greedily

const books = BOOKS.map((titleAr, order) => {
  const ls = lessons.filter(l => l.book.replace(/الايمان/, 'الأيمان').replace(/الأطعمه/, 'الأطعمة') === titleAr);
  const chapters: { titleAr: string; lessonIds: number[] }[] = [];
  for (const l of ls) {
    const c = chapters.find(x => x.titleAr === l.chapter);
    if (c) c.lessonIds.push(l.id); else chapters.push({ titleAr: l.chapter, lessonIds: [l.id] });
  }
  return { id: `book-${order + 1}`, order: order + 1, titleAr, available: ls.length > 0, lessonCount: ls.length, chapters };
});
const unplaced = lessons.filter(l => !books.some(b => b.chapters.some(c => c.lessonIds.includes(l.id))));
if (unplaced.length) throw new Error(`lessons without a book: ${unplaced.map(l => l.id).join(',')}`);

const header = `/**
 * Generated by scripts/build-fiqh-course.ts — do not edit by hand.
 * «الفقه الميسر» course: matn from «الفقه الميسر في ضوء الكتاب والسنة» (مجمع الملك فهد لطباعة المصحف الشريف),
 * explanation lessons edited by منصة يَسِّر (fqh.me), used with the author's permission and edited by Noor.
 */
`;
const body = `export const FIQH_COURSE_VERSION = ${FIQH_COURSE_VERSION};

export const FIQH_COURSE_META = ${JSON.stringify({
  id: 'fiqh-muyassar',
  titleAr: 'الفقه الميسّر',
  titleEn: 'Fiqh Made Easy',
  subtitleAr: 'المتن مع الشرح، مسألةً مسألة',
  descriptionAr: 'دراسة «الفقه الميسر في ضوء الكتاب والسنة» مسألةً مسألة: نص الكتاب، ثم ما زاده الشارح، مع مقطع الدرس المرئي من موضع المسألة.',
  sourcesAr: [
    'المتن: «الفقه الميسر في ضوء الكتاب والسنة»، نخبة من العلماء، مجمع الملك فهد لطباعة المصحف الشريف.',
    'الشرح ومقاطع الدروس: منصة «يَسِّر» (fqh.me)، بإذن صاحبها.',
    'مراجعة نور: مطابقة المتن على الكتاب المطبوع، وتحرير الشرح لغويًا، وتخريج الأحاديث من الصحيحين وسنن أبي داود والترمذي.',
  ],
  platformUrl: 'https://fqh.me',
  noticeAr: 'ما زاده الشارح يُعرض بعد المتن، وقد يخالف الكتاب في بعض المسائل؛ وفي المسائل الخلافية يُرجع إلى أهل العلم.',
}, null, 2)} as const;

export const FIQH_BOOKS = ${JSON.stringify(books, null, 1)};

export const FIQH_LESSONS = ${JSON.stringify(lessons, null, 1)};

export const FIQH_GLOSSARY = ${JSON.stringify(glossary, null, 1)};

/** For reviewers only (not served). */
export const FIQH_REVIEW_NOTES: Record<number, string[]> = ${JSON.stringify(REVIEW, null, 1)};
`;
const content = header + body;
if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== content) { console.error('src/shared/data/fiqh-course.ts is out of date: run npx tsx scripts/build-fiqh-course.ts'); process.exit(1); }
  console.log('fiqh course up to date');
} else {
  writeFileSync(OUT, content);
  const q = lessons.reduce((a, l) => a + l.citations.length, 0);
  console.log(`fiqh course: ${lessons.length} lessons, ${glossary.length} terms, ${q} verified quotes, ${Object.values(REVIEW).flat().length} review notes, ${Math.round(content.length / 1024)} KB`);
}
