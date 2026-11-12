/**
 * Quran station (part of the Listen section, not a separate feature):
 *  - live radio stations (mp3quran.net snapshot, each stream checked),
 *  - a daily playlist that is the same for everyone on a given day and changes every day,
 *  - personal playlists that mix full surahs, verse ranges (per-verse reciters) and radio stations.
 * Playback, offline caching, downloads and the sleep timer are the existing player's job (client).
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { CATALOG_SURAHS } from '../data/surahs';
import { QURAN_RADIOS, RADIO_CATEGORIES, type RadioCategory } from '../shared/data/quran-radios';
import { SURAH_AUDIO_RECITERS } from '../shared/data/surah-audio-reciters';
import { SURAH_AUDIO_RIWAYAT, surahAudioUrl } from './surah-audio.service';
import { QURAN_RECITERS } from './quran.service';

type Db = any;

// ---------------------------------------------------------------- radios
const radioDto = (r: (typeof QURAN_RADIOS)[number]) => ({
  id: r[0], nameAr: r[1], nameEn: r[2], streamUrl: r[3], category: r[4] as RadioCategory, variantAr: r[5],
  categoryAr: RADIO_CATEGORIES[r[4] as RadioCategory],
});

export function getRadioStations(category?: string) {
  if (category && !(category in RADIO_CATEGORIES)) throw new AppError('Unknown radio category', 400, ErrorCodes.VALIDATION_ERROR);
  const counts: Record<string, number> = {};
  for (const r of QURAN_RADIOS) counts[r[4]] = (counts[r[4]] ?? 0) + 1;
  return {
    source: { nameAr: 'إذاعات mp3quran.net', url: 'https://mp3quran.net' },
    total: QURAN_RADIOS.length,
    categories: (Object.keys(RADIO_CATEGORIES) as RadioCategory[]).filter(k => counts[k]).map(key => ({ key, nameAr: RADIO_CATEGORIES[key], count: counts[key] })),
    stations: QURAN_RADIOS.filter(r => !category || r[4] === category).map(radioDto),
  };
}

const radioById = new Map(QURAN_RADIOS.map(r => [r[0], r]));
const recitationById = new Map(SURAH_AUDIO_RECITERS.map(r => [r[0], r]));
const verseReciterIds = new Set(QURAN_RECITERS.filter((r: any) => r.riwaya !== 'Warsh').map((r: any) => r.id as string));
const surah = (id: number) => CATALOG_SURAHS.find(s => s.id === id)!;

// ---------------------------------------------------------------- daily playlist
/** Deterministic PRNG (mulberry32) so a day's playlist is identical for everyone and on every request. */
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const daySeed = (dayKey: string) => [...dayKey].reduce((h, c) => (Math.imul(h, 31) + c.charCodeAt(0)) | 0, 7);

/**
 * Six surahs a day, each by a different Hafs reciter: one from the long surahs (2–9), two medium (10–49),
 * three short (50–114), in mushaf order. Same date → same playlist.
 */
export function getDailyPlaylist(dayKey: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dayKey)) throw new AppError('Invalid date', 400, ErrorCodes.VALIDATION_ERROR);
  const r = rng(daySeed(dayKey));
  const pick = <T,>(pool: T[], n: number) => { const p = [...pool]; const out: T[] = []; while (out.length < n && p.length) out.push(p.splice(Math.floor(r() * p.length), 1)[0]!); return out; };
  const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);
  const surahIds = [...pick(range(2, 9), 1), ...pick(range(10, 49), 2), ...pick(range(50, 114), 3)].sort((a, b) => a - b);
  const hafs = SURAH_AUDIO_RECITERS.filter(x => x[4] === 'Hafs');
  const reciters = pick(hafs, surahIds.length);
  return {
    date: dayKey,
    titleAr: 'قائمة اليوم',
    subtitleAr: 'ست سور بأصوات مختلفة، تتجدد كل يوم',
    items: surahIds.map((id, i) => {
      const rec = reciters[i]!;
      return { kind: 'SURAH' as const, surahId: id, surahNameAr: surah(id).nameAr, recitationId: rec[0], reciterNameAr: rec[1],
        recitationAr: rec[3], riwaya: rec[4], audioUrl: surahAudioUrl(rec[5], id) };
    }),
  };
}

// ---------------------------------------------------------------- personal playlists
const itemSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('SURAH'), recitationId: z.number().int(), surahId: z.number().int().min(1).max(114) }).strict(),
  z.object({ kind: z.literal('VERSES'), reciterId: z.string().min(1).max(80), surahId: z.number().int().min(1).max(114),
    fromAyah: z.number().int().min(1), toAyah: z.number().int().min(1) }).strict(),
  z.object({ kind: z.literal('RADIO'), radioId: z.number().int() }).strict(),
]);
export const playlistInputSchema = z.object({
  name: z.string().trim().min(1).max(60),
  items: z.array(itemSchema).max(200),
  revision: z.number().int().min(0).optional(),
}).strict();
export type PlaylistItemInput = z.infer<typeof itemSchema>;
export const MAX_PLAYLISTS = 50;

function validateItem(item: PlaylistItemInput, index: number) {
  const bad = (m: string) => new AppError(`Item ${index + 1}: ${m}`, 400, ErrorCodes.VALIDATION_ERROR);
  if (item.kind === 'SURAH' && !recitationById.has(item.recitationId)) throw bad('unknown recitation');
  if (item.kind === 'RADIO' && !radioById.has(item.radioId)) throw bad('unknown radio station');
  if (item.kind === 'VERSES') {
    if (!verseReciterIds.has(item.reciterId)) throw bad('unknown verse-by-verse reciter');
    if (item.fromAyah > item.toAyah || item.toAyah > surah(item.surahId).totalAyahs) throw bad('invalid verse range');
  }
}

/** Resolves stored items into what the player needs; items whose source was removed come back with available=false. */
export function resolveItem(item: PlaylistItemInput) {
  if (item.kind === 'SURAH') {
    const rec = recitationById.get(item.recitationId);
    return { ...item, surahNameAr: surah(item.surahId).nameAr, available: !!rec, reciterNameAr: rec?.[1] ?? null,
      recitationAr: rec?.[3] ?? null, riwayaAr: rec ? SURAH_AUDIO_RIWAYAT[rec[4]] ?? rec[4] : null, audioUrl: rec ? surahAudioUrl(rec[5], item.surahId) : null };
  }
  if (item.kind === 'RADIO') {
    const r = radioById.get(item.radioId);
    return { ...item, available: !!r, nameAr: r?.[1] ?? null, variantAr: r?.[5] ?? null, streamUrl: r?.[3] ?? null };
  }
  const reciter: any = QURAN_RECITERS.find((r: any) => r.id === item.reciterId);
  return { ...item, surahNameAr: surah(item.surahId).nameAr, available: !!reciter, reciterNameAr: reciter?.nameAr ?? null,
    // The client builds the verse queue with GET /quran/audio/playlist using these parameters.
    playlistQuery: { surahId: item.surahId, fromAyah: item.fromAyah, toAyah: item.toAyah, reciterId: item.reciterId } };
}

const out = (r: any) => {
  const items = (Array.isArray(r.items) ? r.items : []).map((i: PlaylistItemInput) => resolveItem(i));
  return { id: r.id, name: r.name, revision: Number(r.revision), itemCount: items.length, items,
    createdAt: new Date(r.createdAt).toISOString(), updatedAt: new Date(r.updatedAt).toISOString() };
};

export async function listPlaylists(userId: string, db: Db = prisma) {
  const rows: any[] = await db.$queryRaw`SELECT * FROM "quran_playlists" WHERE "userId"=${userId} ORDER BY "updatedAt" DESC`;
  return { playlists: rows.map(out), max: MAX_PLAYLISTS };
}

export async function getPlaylist(userId: string, id: string, db: Db = prisma) {
  const rows: any[] = await db.$queryRaw`SELECT * FROM "quran_playlists" WHERE "id"=${id} AND "userId"=${userId}`;
  if (!rows.length) throw new AppError('Playlist not found', 404, ErrorCodes.NOT_FOUND);
  return out(rows[0]);
}

export async function createPlaylist(userId: string, raw: unknown, db: Db = prisma) {
  const v = playlistInputSchema.parse(raw);
  v.items.forEach(validateItem);
  const count: any[] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "quran_playlists" WHERE "userId"=${userId}`;
  if (Number(count[0].n) >= MAX_PLAYLISTS) throw new AppError(`At most ${MAX_PLAYLISTS} playlists`, 409, ErrorCodes.CONFLICT);
  const rows: any[] = await db.$queryRaw`INSERT INTO "quran_playlists" ("id","userId","name","items","updatedAt")
    VALUES (${randomUUID()},${userId},${v.name},${JSON.stringify(v.items)}::jsonb,CURRENT_TIMESTAMP) RETURNING *`;
  return out(rows[0]);
}

/** Replaces name and items. When `revision` is sent and the stored one is newer, returns 409 (edited on another device). */
export async function updatePlaylist(userId: string, id: string, raw: unknown, db: Db = prisma) {
  const v = playlistInputSchema.parse(raw);
  v.items.forEach(validateItem);
  const rows: any[] = await db.$queryRaw`UPDATE "quran_playlists" SET "name"=${v.name},"items"=${JSON.stringify(v.items)}::jsonb,
    "revision"="revision"+1,"updatedAt"=CURRENT_TIMESTAMP
    WHERE "id"=${id} AND "userId"=${userId} AND (${v.revision ?? null}::int IS NULL OR "revision"=${v.revision ?? null}::int) RETURNING *`;
  if (rows.length) return out(rows[0]);
  await getPlaylist(userId, id, db); // 404 when it does not exist
  throw new AppError('Playlist was changed on another device', 409, ErrorCodes.CONFLICT);
}

export async function deletePlaylist(userId: string, id: string, db: Db = prisma) {
  const n = await db.$executeRaw`DELETE FROM "quran_playlists" WHERE "id"=${id} AND "userId"=${userId}`;
  if (!n) throw new AppError('Playlist not found', 404, ErrorCodes.NOT_FOUND);
  return { deleted: true };
}
