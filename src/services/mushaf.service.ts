import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { prisma } from '../lib/prisma';
import { qfFetchJson, hasQuranFoundationCredentials } from '../lib/quran-foundation';
import { getWarshCapability } from './warsh-content.service';

export const editionIdSchema = z.enum(['madani-hafs', 'indopak-hafs', 'warsh-nafi']);
export type EditionId = z.infer<typeof editionIdSchema>;
const definitions = [
  { id: 'madani-hafs', nameEn: 'Madani · Hafs', nameAr: 'المدينة · حفص', riwayah: 'hafs', script: 'uthmani', pages: 604, mushafId: 4, field: 'text_uthmani' },
  { id: 'indopak-hafs', nameEn: 'Indo-Pak · Hafs (604 pages)', nameAr: 'الهندي الباكستاني · حفص (٦٠٤ صفحات)', riwayah: 'hafs', script: 'indopak', pages: 604, mushafId: 3, field: 'text_indopak' },
  { id: 'warsh-nafi', nameEn: 'Warsh · Nafi', nameAr: 'ورش · نافع', riwayah: 'warsh', script: 'uthmani-warsh', pages: null, mushafId: null, field: null },
] as const;
const verseSchema = z.object({ key: z.string().regex(/^\d{1,3}:\d{1,3}$/), text: z.string().min(1), surah: z.number().int().min(1).max(114), ayah: z.number().int().min(1).max(300) }).strict();
export const warshBundleSchema = z.object({
  editionId: z.literal('warsh-nafi'), version: z.string().min(1).max(80),
  sourceUrl: z.string().url().refine(v => { const h = new URL(v).hostname; return h === 'qurancomplex.gov.sa' || h.endsWith('.qurancomplex.gov.sa') || h === 'qul.tarteel.ai'; }),
  licenseEvidence: z.string().min(20), reviewedBy: z.string().min(3), reviewedAt: z.string().datetime(),
  pages: z.array(z.object({ number: z.number().int().positive(), verses: z.array(verseSchema).min(1) }).strict()).min(500).max(700),
}).strict().superRefine((b, c) => {
  const keys = new Set<string>(); const surahs = new Set<number>();
  const seen = new Map<string, { text: string; page: number }>();
  let previousSurah = 1; let previousAyah = 0;
  b.pages.forEach((p, i) => {
    if (p.number !== i + 1) c.addIssue({ code: z.ZodIssueCode.custom, message: 'Pages must be complete and consecutive' });
    p.verses.forEach(v => {
      const earlier = seen.get(v.key);
      const continuation = Boolean(earlier && earlier.text === v.text && earlier.page === p.number - 1 && v.surah === previousSurah && v.ayah === previousAyah);
      if (v.key !== `${v.surah}:${v.ayah}` || (earlier && !continuation)) c.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid or nonadjacent repeated Warsh-local verse key' });
      if (v.surah !== previousSurah && (v.surah !== previousSurah + 1 || v.ayah !== 1)) c.addIssue({ code: z.ZodIssueCode.custom, message: 'Nonconsecutive surah order' });
      if (!continuation && v.surah === previousSurah && v.ayah !== previousAyah + 1) c.addIssue({ code: z.ZodIssueCode.custom, message: 'Missing or nonconsecutive ayah' });
      previousSurah = v.surah; previousAyah = v.ayah;
      keys.add(v.key); surahs.add(v.surah);
      seen.set(v.key, { text: v.text, page: p.number });
    });
  });
  if (surahs.size !== 114) c.addIssue({ code: z.ZodIssueCode.custom, message: 'All 114 surahs are required' });
  if (keys.size < 6000) c.addIssue({ code: z.ZodIssueCode.custom, message: 'Incomplete Quran content' });
});
type WarshBundle = z.infer<typeof warshBundleSchema>;
let warsh: WarshBundle | null = null;
let warshLoaded = false;
function loadWarsh(): WarshBundle | null {
  if (warshLoaded) return warsh;
  warshLoaded = true;
  const file = process.env.NOOR_WARSH_BUNDLE_PATH;
  const expected = process.env.NOOR_WARSH_BUNDLE_SHA256;
  if (!file || !expected || !/^[a-f0-9]{64}$/i.test(expected)) return null;
  try {
    const bytes = readFileSync(file);
    if (createHash('sha256').update(bytes).digest('hex') !== expected.toLowerCase()) return null;
    warsh = warshBundleSchema.parse(JSON.parse(bytes.toString('utf8')));
  } catch { warsh = null; }
  return warsh;
}
export function getMushafEditions() {
  const bundle = loadWarsh();
  const text = getWarshCapability();
  return definitions.map(d => ({ ...d, pages: d.id === 'warsh-nafi' ? bundle?.pages.length ?? null : d.pages,
    available: d.id === 'warsh-nafi' ? text.available : hasQuranFoundationCredentials(),
    availabilityReason: d.id === 'warsh-nafi' ? text.reason : !hasQuranFoundationCredentials() ? 'QF_CREDENTIALS_REQUIRED' : null,
    navigation: d.id === 'warsh-nafi' ? 'SURAH_AYAH' : 'PAGE',
    textReadingAvailable: d.id === 'warsh-nafi' ? text.available : hasQuranFoundationCredentials(),
    pageReadingAvailable: d.id === 'warsh-nafi' ? text.available && Boolean(bundle) : hasQuranFoundationCredentials(),
    khatmahUnit: d.id === 'warsh-nafi' ? 'VERSE' : 'PAGE',
    rendering: 'UNICODE_REFLOW', exactPrintedPageLayout: false,
    source: d.id === 'warsh-nafi' ? bundle?.sourceUrl ?? 'https://qurancomplex.gov.sa/en/techquran/dev/' : 'https://api-docs.quran.com/docs/tutorials/fonts/page-layout/',
    contentVersion: d.id === 'warsh-nafi' ? text.contentVersion : 'qf-v4',
    offlineDownloadAvailable: false,
    legacyKhatmahCompatible: d.riwayah === 'hafs',
  }));
}
function edition(id: EditionId) {
  const d = getMushafEditions().find(v => v.id === id)!;
  if (!d.available) throw new AppError('Verified edition content is unavailable; another edition cannot be substituted.', 503, ErrorCodes.INTERNAL_SERVER_ERROR, { reason: d.availabilityReason });
  if (id === 'warsh-nafi' && !d.pageReadingAvailable) throw new AppError('Warsh uses surah/ayah routes; matching printed pages are not installed', 409, ErrorCodes.VALIDATION_ERROR);
  return d;
}
type QfVerse = { verse_key: string; verse_number: number; text_uthmani?: string; text_indopak?: string };
type QfPage = { verses: QfVerse[]; pagination: { next_page: number | null; total_records: number } };
// Bounded process cache for public content only. Never persist API responses as an offline corpus.
const pageCache = new Map<string, { expires: number; data: unknown }>();
const pending = new Map<string, Promise<any>>();
export async function getMushafPage(id: EditionId, page: number): Promise<any> {
  const d = edition(id);
  if (!Number.isInteger(page) || page < 1 || page > d.pages!) throw new AppError('Page outside this edition', 400, ErrorCodes.VALIDATION_ERROR);
  if (id === 'warsh-nafi') return { editionId: id, riwayah: d.riwayah, page, totalPages: d.pages, rendering: d.rendering, contentVersion: d.contentVersion, verses: loadWarsh()!.pages[page - 1]!.verses };
  const key = `${id}:${page}`; const cached = pageCache.get(key);
  if (cached && cached.expires > Date.now()) return cached.data;
  if (pending.has(key)) return pending.get(key);
  const request = (async () => {
    const verses: z.infer<typeof verseSchema>[] = [];
    let cursor: number | null = 1;
    let totalRecords: number | null = null;
    try {
      for (let count = 0; cursor !== null && count < 8; count++) {
        const response: QfPage | null = await qfFetchJson<QfPage>(`/verses/by_page/${page}`, { mushaf: d.mushafId!, fields: d.field!, per_page: 50, page: cursor }, false);
        if (!response || !Array.isArray(response.verses) || !response.pagination) throw new Error('Invalid provider response');
        if (!Number.isInteger(response.pagination.total_records) || response.pagination.total_records < 1) throw new Error('Invalid total');
        if (totalRecords !== null && totalRecords !== response.pagination.total_records) throw new Error('Provider content changed during pagination');
        totalRecords = response.pagination.total_records;
        for (const v of response.verses) {
          const [surah, ayah] = v.verse_key.split(':').map(Number);
          if (v.verse_number !== ayah) throw new Error('Invalid verse identifier');
          verses.push(verseSchema.parse({ key: v.verse_key, surah, ayah, text: d.field === 'text_indopak' ? v.text_indopak : v.text_uthmani }));
        }
        const next: number | null = response.pagination.next_page;
        if (next !== null && (!Number.isInteger(next) || next <= cursor)) throw new Error('Invalid pagination');
        cursor = next;
      }
      if (cursor !== null || verses.length !== totalRecords || new Set(verses.map(v => v.key)).size !== verses.length) throw new Error('Incomplete provider page');
      const bounds = await qfFetchJson<{ pages: Record<string, { first_verse_key: string; last_verse_key: string }> }>('/pages/lookup', { mushaf: d.mushafId!, page_number: page }, false);
      if (bounds?.pages?.[String(page)]?.first_verse_key !== verses[0]!.key || bounds?.pages?.[String(page)]?.last_verse_key !== verses[verses.length - 1]!.key) throw new Error('Edition page mapping mismatch');
    } catch {
      throw new AppError('Quran content provider temporarily unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    }
    const data = { editionId: id, riwayah: d.riwayah, page, totalPages: d.pages, rendering: d.rendering, contentVersion: d.contentVersion, verses };
    if (pageCache.size >= 128) pageCache.delete(pageCache.keys().next().value!);
    pageCache.set(key, { expires: Date.now() + 300_000, data });
    return data;
  })();
  pending.set(key, request);
  try { return await request; } finally { pending.delete(key); }
}
export const readerStateSchema = z.object({ page: z.number().int().positive(), verseKey: z.string().regex(/^\d{1,3}:\d{1,3}$/).nullable(), revision: z.number().int().min(0) }).strict();
export async function getMushafReaderState(userId: string, id: EditionId) {
  const d = edition(id);
  const rows = await prisma.$queryRaw<Array<{ page: number; verseKey: string | null; revision: number }>>`SELECT "page", "verseKey", "revision" FROM "mushaf_reader_states" WHERE "userId"=${userId} AND "editionId"=${id}`;
  return { editionId: id, contentVersion: d.contentVersion, ...(rows[0] ?? { page: 1, verseKey: null, revision: 0 }) };
}
export async function setMushafReaderState(userId: string, id: EditionId, input: z.infer<typeof readerStateSchema>) {
  const page = await getMushafPage(id, input.page);
  if (input.verseKey !== null && !page.verses.some((v: { key: string }) => v.key === input.verseKey)) throw new AppError('Verse does not belong to this edition page', 400, ErrorCodes.VALIDATION_ERROR);
  const previous = await getMushafReaderState(userId, id);
  if (previous.revision === input.revision + 1 && previous.page === input.page && previous.verseKey === input.verseKey) return previous;
  const changed = await prisma.$executeRaw`INSERT INTO "mushaf_reader_states" ("userId","editionId","page","verseKey","revision","updatedAt") SELECT ${userId},${id},${input.page},${input.verseKey},1,CURRENT_TIMESTAMP WHERE ${input.revision}=0 OR EXISTS (SELECT 1 FROM "mushaf_reader_states" WHERE "userId"=${userId} AND "editionId"=${id} AND "revision"=${input.revision}) ON CONFLICT ("userId","editionId") DO UPDATE SET "page"=EXCLUDED."page","verseKey"=EXCLUDED."verseKey","revision"="mushaf_reader_states"."revision"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "mushaf_reader_states"."revision"=${input.revision}`;
  if (!changed) throw new AppError('Reading position changed on another device; reload state', 409, ErrorCodes.VALIDATION_ERROR);
  return getMushafReaderState(userId, id);
}

export async function getMushafPreference(userId: string) {
  const rows = await prisma.$queryRaw<Array<{ editionId: EditionId }>>`SELECT "editionId" FROM "mushaf_preferences" WHERE "userId"=${userId}`;
  const id = rows[0]?.editionId ?? 'madani-hafs';
  return { editionId: id, available: getMushafEditions().find(e => e.id === id)!.available };
}
export async function setMushafPreference(userId: string, id: EditionId) {
  if (id === 'warsh-nafi') { const capability = getWarshCapability(); if (!capability.available) throw new AppError('Warsh text unavailable',503,ErrorCodes.INTERNAL_SERVER_ERROR,{reason:capability.reason}); }
  else edition(id);
  await prisma.$executeRaw`INSERT INTO "mushaf_preferences" ("userId","editionId") VALUES (${userId},${id}) ON CONFLICT ("userId") DO UPDATE SET "editionId"=EXCLUDED."editionId"`;
  return getMushafPreference(userId);
}
export const mushafBookmarkSchema = z.object({ page: z.number().int().positive(), verseKey: z.string().regex(/^\d{1,3}:\d{1,3}$/), note: z.string().max(500).default(''), saved: z.boolean() }).strict();
export async function getMushafBookmarks(userId: string, id: EditionId) {
  edition(id);
  return prisma.$queryRaw`SELECT "page","verseKey","note","updatedAt" FROM "mushaf_bookmarks" WHERE "userId"=${userId} AND "editionId"=${id} ORDER BY "updatedAt" DESC LIMIT 500`;
}
export async function setMushafBookmark(userId: string, id: EditionId, input: z.infer<typeof mushafBookmarkSchema>) {
  const data = await getMushafPage(id, input.page);
  if (!data.verses.some((v: { key: string }) => v.key === input.verseKey)) throw new AppError('Verse does not belong to this edition page', 400, ErrorCodes.VALIDATION_ERROR);
  if (!input.saved) await prisma.$executeRaw`DELETE FROM "mushaf_bookmarks" WHERE "userId"=${userId} AND "editionId"=${id} AND "verseKey"=${input.verseKey}`;
  else await prisma.$executeRaw`INSERT INTO "mushaf_bookmarks" ("userId","editionId","verseKey","page","note","updatedAt") VALUES (${userId},${id},${input.verseKey},${input.page},${input.note},CURRENT_TIMESTAMP) ON CONFLICT ("userId","editionId","verseKey") DO UPDATE SET "page"=EXCLUDED."page","note"=EXCLUDED."note","updatedAt"=CURRENT_TIMESTAMP`;
  return { editionId: id, ...input };
}

