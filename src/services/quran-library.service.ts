/**
 * Quran knowledge library (static, offline, checksum-verified): المختصر في التفسير، إعراب (المجتبى للخراط)،
 * المتشابهات، القراءات العشر، الموضوعات، معلومات السور، التحليل الصرفي (Quranic Arabic Corpus), word statistics,
 * the rub' index and word audio. Data files live in src/shared/data/quran-library (see manifest.json for sources and
 * hashes) and are loaded lazily, once, on first use.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { CATALOG_SURAHS } from '../data/surahs';
import { QURAN_RUB_INDEX } from '../shared/data/quran-rub-index';

const DIR = join(__dirname, '../shared/data/quran-library');
type ManifestFile = { file: string; sha256: string; rows: number; source: Record<string, string> };
let manifestCache: { provider: string; files: Record<string, ManifestFile> } | undefined;
export function libraryManifest() {
  if (!manifestCache) manifestCache = JSON.parse(readFileSync(join(DIR, 'manifest.json'), 'utf8'));
  return manifestCache!;
}

const loaded = new Map<string, unknown>();
function dataset<T>(name: string): T {
  if (loaded.has(name)) return loaded.get(name) as T;
  const meta = libraryManifest().files[name];
  if (!meta) throw new Error(`Unknown dataset ${name}`);
  const gz = readFileSync(join(DIR, meta.file));
  if (createHash('sha256').update(gz).digest('hex') !== meta.sha256) throw new Error(`Checksum mismatch for ${name}`);
  const value = JSON.parse(gunzipSync(gz).toString('utf8')) as T;
  loaded.set(name, value);
  return value;
}
const indexes = new Map<string, Map<string, unknown>>();
function byVerse<T>(name: string): Map<string, T> {
  if (!indexes.has(name)) {
    const m = new Map<string, unknown>();
    for (const row of dataset<Array<[number, number, unknown]>>(name)) m.set(`${row[0]}:${row[1]}`, row[2]);
    indexes.set(name, m);
  }
  return indexes.get(name) as Map<string, T>;
}

export function checkVerse(surahId: number, ayahNumber: number) {
  const surah = CATALOG_SURAHS.find(s => s.id === surahId);
  if (!surah || !Number.isInteger(ayahNumber) || ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
    throw new AppError('Invalid Quran verse coordinates', 400, ErrorCodes.VALIDATION_ERROR);
  }
  return surah;
}
const nameAr = (id: number) => CATALOG_SURAHS.find(s => s.id === id)?.nameAr ?? '';
const source = (name: string) => libraryManifest().files[name]!.source;

// ------------------------------------------------------------------ morphology & statistics

type Segment = [string, number, string, string, string, string]; // form, role(0 prefix,1 stem,2 suffix), description, root, lemma, pattern
type MorphWord = [string, Segment[]];
const ROLE = ['prefix', 'stem', 'suffix'] as const;
/** Strip harakat, Quranic marks and tatweel so the same written word matches across the mushaf. */
export function wordKey(text: string) {
  return text.normalize('NFC').replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '').replace(/[ٱأإآ]/g, 'ا').replace(/ى/g, 'ي').trim();
}
type Stats = { exact: Map<string, { count: number; surahs: Set<number> }>; forms: Map<string, { count: number; surahs: Set<number> }>; roots: Map<string, { count: number; ayahs: Set<string>; surahs: Set<number> }>; rootRank: Map<string, number> };
let statsCache: Stats | undefined;
function stats(): Stats {
  if (statsCache) return statsCache;
  const forms = new Map<string, { count: number; surahs: Set<number> }>();
  const exact = new Map<string, { count: number; surahs: Set<number> }>();
  const roots = new Map<string, { count: number; ayahs: Set<string>; surahs: Set<number> }>();
  for (const [s, a, words] of dataset<Array<[number, number, MorphWord[]]>>('morphology')) {
    for (const [text, segs] of words) {
      const k = wordKey(text);
      const f = forms.get(k) ?? { count: 0, surahs: new Set<number>() };
      f.count++; f.surahs.add(s); forms.set(k, f);
      const ek = text.normalize('NFC');
      const e = exact.get(ek) ?? { count: 0, surahs: new Set<number>() };
      e.count++; e.surahs.add(s); exact.set(ek, e);
      const root = segs.find(x => x[3])?.[3];
      if (root) {
        const r = roots.get(root) ?? { count: 0, ayahs: new Set<string>(), surahs: new Set<number>() };
        r.count++; r.ayahs.add(`${s}:${a}`); r.surahs.add(s); roots.set(root, r);
      }
    }
  }
  const rootRank = new Map([...roots.entries()].sort((x, y) => y[1].count - x[1].count).map(([r], i) => [r, i + 1]));
  statsCache = { exact, forms, roots, rootRank };
  return statsCache;
}

function describeWord(surahId: number, ayahNumber: number, position: number, w: MorphWord) {
  const st = stats();
  const root = w[1].find(x => x[3])?.[3] || null;
  const lemma = w[1].find(x => x[1] === 1)?.[4] || null;
  const form = st.forms.get(wordKey(w[0]));
  const exact = st.exact.get(w[0].normalize('NFC'));
  const r = root ? st.roots.get(root) : undefined;
  return {
    position, text: w[0],
    audioUrl: `https://audio.qurancdn.com/wbw/${String(surahId).padStart(3, '0')}_${String(ayahNumber).padStart(3, '0')}_${String(position).padStart(3, '0')}.mp3`,
    root, lemma,
    segments: w[1].map(([formText, role, description, segRoot, segLemma, pattern]) => ({
      form: formText, role: ROLE[role] ?? 'stem', description, root: segRoot || null, lemma: segLemma || null, pattern: pattern || null,
    })),
    statistics: {
      exactOccurrences: exact?.count ?? 0, exactSurahs: exact?.surahs.size ?? 0,
      wordOccurrences: form?.count ?? 0, wordSurahs: form?.surahs.size ?? 0,
      rootOccurrences: r?.count ?? null, rootAyahs: r?.ayahs.size ?? null, rootSurahs: r?.surahs.size ?? null,
      rootRank: root ? st.rootRank.get(root) ?? null : null, totalRoots: st.roots.size,
    },
  };
}

export function getAyahWords(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  const words = byVerse<MorphWord[]>('morphology').get(`${surahId}:${ayahNumber}`) ?? [];
  return { verseKey: `${surahId}:${ayahNumber}`, source: source('morphology'), statisticsMethod: STATISTICS_METHOD_AR,
    words: words.map((w, i) => describeWord(surahId, ayahNumber, i + 1, w)) };
}

export function getWord(surahId: number, ayahNumber: number, position: number) {
  checkVerse(surahId, ayahNumber);
  const words = byVerse<MorphWord[]>('morphology').get(`${surahId}:${ayahNumber}`) ?? [];
  const w = words[position - 1];
  if (!Number.isInteger(position) || !w) throw new AppError('Invalid word position', 400, ErrorCodes.VALIDATION_ERROR);
  const qiraat = getAyahQiraat(surahId, ayahNumber).words.filter(q => wordKey(q.word).includes(wordKey(w[0])) || wordKey(w[0]).includes(wordKey(q.word)));
  return { verseKey: `${surahId}:${ayahNumber}`, source: source('morphology'), statisticsMethod: STATISTICS_METHOD_AR,
    ...describeWord(surahId, ayahNumber, position, w), qiraat };
}

export const STATISTICS_METHOD_AR = [
  'تكرار الكلمة بضبطها: تُعدّ الكلمة كما رُسمت بحركاتها، فـ(الرحيمُ) غير (الرحيمِ).',
  'تكرار الكلمة برسمها: تُعدّ دون الحركات وعلامات الضبط، فـ(الرحيمُ) و(الرحيمِ) كلمة واحدة.',
  'تُعدّ الكلمة مع سوابقها ولواحقها كما رُسمت في المصحف، فـ(والله) غير (الله).',
  'الجذر وترتيبه بحسب التحليل الصرفي لكل كلمة (المدونة القرآنية العربية)؛ والترتيب 1 هو الأكثر ورودًا.',
];

/** Verses where a root occurs (search by root). */
export function getRootOccurrences(root: string, limit = 300) {
  const r = stats().roots.get(root.trim());
  if (!r) throw new AppError('Root not found', 404, ErrorCodes.NOT_FOUND);
  const ayahs = [...r.ayahs];
  return { root: root.trim(), occurrences: r.count, ayahCount: r.ayahs.size, surahCount: r.surahs.size, rank: stats().rootRank.get(root.trim()) ?? null,
    verseKeys: ayahs.slice(0, limit), truncated: ayahs.length > limit };
}

// ------------------------------------------------------------------ verse-level panels

export function getAyahMukhtasar(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  return { source: source('mukhtasar'), text: byVerse<string>('mukhtasar').get(`${surahId}:${ayahNumber}`) ?? null };
}
export function getAyahIrab(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  return { source: source('e3rab'), text: byVerse<string>('e3rab').get(`${surahId}:${ayahNumber}`) ?? null };
}
type QiraaRow = [string, Array<[string, Array<[string, string, string]>]>];
export function getAyahQiraat(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  const base = (source('qiraat') as any).audioBase as string;
  const rows = byVerse<QiraaRow[]>('qiraat').get(`${surahId}:${ayahNumber}`) ?? [];
  return {
    source: source('qiraat'),
    words: rows.map(([word, variants]) => ({
      word,
      variants: variants.map(([text, readers]) => ({
        text,
        readers: readers.map(([qari, rawi, audio]) => ({ qari, rawi, audioUrl: !audio ? null : /^https?:\/\//.test(audio) ? audio : base + audio })),
      })),
    })),
  };
}
type SimilarGroup = [string, Array<[number, number]>];
export function getAyahSimilar(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  const groups = byVerse<SimilarGroup[]>('similar').get(`${surahId}:${ayahNumber}`) ?? [];
  return {
    source: source('similar'),
    groups: groups.map(([note, keys]) => ({
      note,
      verses: keys.filter(([s, a]) => !(s === surahId && a === ayahNumber)).map(([s, a]) => ({ verseKey: `${s}:${a}`, surahId: s, ayahNumber: a, surahNameAr: nameAr(s) })),
    })).filter(g => g.verses.length > 0),
  };
}
type TopicsData = { dict: Record<string, [string, string | null, number | null, string]>; ayahs: Array<[number, number, number[]]> };
export function getAyahTopics(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  const d = dataset<TopicsData>('topics');
  if (!indexes.has('topics')) indexes.set('topics', new Map(d.ayahs.map(([s, a, ids]) => [`${s}:${a}`, ids])));
  const ids = (indexes.get('topics')!.get(`${surahId}:${ayahNumber}`) as number[] | undefined) ?? [];
  return { source: source('topics'), topics: ids.map(id => topicSummary(id, d)) };
}
function topicSummary(id: number, d = dataset<TopicsData>('topics')) {
  const [name, parentName, parentId, related] = d.dict[String(id)]!;
  return { id, name, parent: parentId ? { id: parentId, name: parentName } : null, verseCount: related ? related.split(',').length : 0 };
}

/** Topic tree: parents with their sub-topics. */
export function getTopicTree() {
  const d = dataset<TopicsData>('topics');
  const parents = new Map<number, { id: number; name: string; children: Array<ReturnType<typeof topicSummary>> }>();
  for (const id of Object.keys(d.dict).map(Number)) {
    const t = topicSummary(id, d);
    const pid = t.parent?.id ?? t.id;
    const pname = t.parent?.name ?? t.name;
    if (!parents.has(pid)) parents.set(pid, { id: pid, name: pname, children: [] });
    if (t.parent) parents.get(pid)!.children.push(t);
  }
  return { source: source('topics'), topics: [...parents.values()].sort((a, b) => a.id - b.id) };
}
export function getTopic(id: number) {
  const d = dataset<TopicsData>('topics');
  const row = d.dict[String(id)];
  if (!row) throw new AppError('Topic not found', 404, ErrorCodes.NOT_FOUND);
  const keys = row[3] ? row[3].split(',').filter(Boolean) : [];
  return { ...topicSummary(id, d), verseKeys: keys };
}

// ------------------------------------------------------------------ surah sciences

type SurahInfo = { introduction: string | null; type: string | null; order: string | null; words: string | null; names: string | null;
  topics: string | null; purposes: string | null; counts: Array<[string, number]> };
export function getSurahInfo(surahId: number) {
  const surah = CATALOG_SURAHS.find(s => s.id === surahId);
  if (!surah) throw new AppError('Invalid surah', 400, ErrorCodes.VALIDATION_ERROR);
  const row = dataset<Array<[number, SurahInfo]>>('surahs').find(r => r[0] === surahId)?.[1];
  const rubs = QURAN_RUB_INDEX.filter(r => r[1] === surahId).length;
  let words = 0, letters = 0;
  for (let a = 1; a <= surah.totalAyahs; a++) for (const w of byVerse<MorphWord[]>('morphology').get(`${surahId}:${a}`) ?? []) { words++; letters += wordKey(w[0]).replace(/\s/g, '').length; }
  return {
    surahId, nameAr: surah.nameAr, totalAyahs: surah.totalAyahs, source: source('surahs'),
    introduction: row?.introduction ?? null, names: row?.names ?? null, topics: row?.topics ?? null, purposes: row?.purposes ?? null,
    statistics: { orderInMushaf: surahId, revelationOrder: row?.order ? Number(row.order) : null, type: row?.type ?? null,
      words, letters, rubsStartingHere: rubs, ayahCountByCounting: (row?.counts ?? []).map(([title, value]) => ({ title, value })) },
  };
}

// ------------------------------------------------------------------ index

export function getRubIndex() {
  return QURAN_RUB_INDEX.map(([rub, surah, ayah, page, juz, hizb, opening]) => ({
    rub, hizb, juz, quarterInHizb: ((rub - 1) % 4) + 1, verseKey: `${surah}:${ayah}`, surahId: surah, surahNameAr: nameAr(surah), ayahNumber: ayah, page, opening,
  }));
}

/** Everything for the verse panel in one call (tabs: الآية). */
export function getAyahLibrary(surahId: number, ayahNumber: number) {
  checkVerse(surahId, ayahNumber);
  return {
    verseKey: `${surahId}:${ayahNumber}`,
    mukhtasar: getAyahMukhtasar(surahId, ayahNumber),
    irab: getAyahIrab(surahId, ayahNumber),
    qiraat: getAyahQiraat(surahId, ayahNumber),
    similar: getAyahSimilar(surahId, ayahNumber),
    topics: getAyahTopics(surahId, ayahNumber),
  };
}

// ------------------------------------------------------------------ search by meaning

const norm = (t: string) => wordKey(t).replace(/ة/g, 'ه').replace(/[^ء-ي\s]/g, ' ').replace(/\s+/g, ' ').trim();
let meaningIndex: Array<{ key: string; s: number; a: number; text: string; normalized: string }> | undefined;
let topicIndex: Array<{ id: number; name: string; normalized: string; keys: string[] }> | undefined;

/**
 * Search verses by meaning: the query is matched against المختصر في التفسير (the meaning of every verse) and the topic
 * names; all query words must appear (prefixes like و/ف/ب/ال are tolerated). Ranked by matches, topic hits first.
 */
export function searchByMeaning(query: string, limit = 50) {
  const q = norm(query);
  const terms = q.split(' ').filter(t => t.length >= 2).map(t => t.replace(/^(و|ف|ب|ل|ك)?(ال)?/, '')).filter(t => t.length >= 2);
  if (!terms.length) throw new AppError('Query too short', 400, ErrorCodes.VALIDATION_ERROR);
  if (!meaningIndex) meaningIndex = dataset<Array<[number, number, string]>>('mukhtasar').map(([s, a, text]) => ({ key: `${s}:${a}`, s, a, text, normalized: ` ${norm(text)} ` }));
  if (!topicIndex) {
    const d = dataset<TopicsData>('topics');
    topicIndex = Object.entries(d.dict).map(([id, [name, , , related]]) => ({ id: Number(id), name, normalized: norm(name), keys: related ? related.split(',').filter(Boolean) : [] }));
  }
  const topics = topicIndex.filter(t => terms.every(term => t.normalized.includes(term))).slice(0, 10);
  const topicKeys = new Set(topics.flatMap(t => t.keys));
  const results: Array<{ verseKey: string; surahId: number; ayahNumber: number; surahNameAr: string; score: number; snippet: string; viaTopic: boolean }> = [];
  for (const row of meaningIndex) {
    let score = 0;
    for (const term of terms) {
      const hits = row.normalized.split(term).length - 1;
      if (!hits) { score = -1; break; }
      score += hits;
    }
    const viaTopic = topicKeys.has(row.key);
    if (score < 0 && !viaTopic) continue;
    const first = row.text.search(new RegExp(terms[0]!.split('').join('[\\u064B-\\u0652\\u0670]*')));
    const start = Math.max(0, first - 60);
    results.push({ verseKey: row.key, surahId: row.s, ayahNumber: row.a, surahNameAr: nameAr(row.s), score: Math.max(0, score) + (viaTopic ? 5 : 0),
      snippet: (start > 0 ? '…' : '') + row.text.slice(start, start + 180) + (row.text.length > start + 180 ? '…' : ''), viaTopic });
  }
  results.sort((x, y) => y.score - x.score || x.surahId - y.surahId || x.ayahNumber - y.ayahNumber);
  return { query, source: source('mukhtasar'), topics: topics.map(t => ({ id: t.id, name: t.name, verseCount: t.keys.length })),
    total: results.length, results: results.slice(0, limit) };
}
