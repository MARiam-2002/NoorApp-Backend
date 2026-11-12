/** Personal highlights (10 colours) and comments with tags on verses or single words ("تلوين" · "تعليقاتي"). */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { CATALOG_SURAHS } from '../data/surahs';

type Db = any;
export const ANNOTATION_COLORS = ['PINK', 'BLUE', 'GREEN', 'YELLOW', 'ORANGE', 'RED', 'TEAL', 'GRAY', 'BROWN', 'PURPLE'] as const;
const verseKey = z.string().regex(/^\d{1,3}:\d{1,3}$/).refine(k => {
  const [s, a] = k.split(':').map(Number);
  const surah = CATALOG_SURAHS.find(x => x.id === s);
  return Boolean(surah && a! >= 1 && a! <= surah.totalAyahs);
}, 'Invalid verse key');
export const annotationInputSchema = z.object({
  verseKey,
  wordPosition: z.number().int().min(0).max(200).default(0),
  color: z.enum(ANNOTATION_COLORS).nullable().default(null),
  comment: z.string().max(5000).default(''),
  tag: z.string().trim().max(40).default(''),
}).strict().refine(v => v.color !== null || v.comment.trim() !== '', { message: 'A colour or a comment is required' });
export const annotationQuerySchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114).optional(),
  type: z.enum(['all', 'highlights', 'comments']).default('all'),
  tag: z.string().trim().max(40).optional(),
  color: z.enum(ANNOTATION_COLORS).optional(),
}).strict();
const EDITIONS = ['madani-hafs', 'indopak-hafs', 'warsh-nafi'];
function edition(id: string) { if (!EDITIONS.includes(id)) throw new AppError('Unknown edition', 400, ErrorCodes.VALIDATION_ERROR); return id; }
const out = (r: any) => ({ id: r.id, verseKey: r.verseKey, wordPosition: r.wordPosition, color: r.color, comment: r.comment, tag: r.tag, updatedAt: new Date(r.updatedAt).toISOString() });

export async function listAnnotations(userId: string, editionId: string, raw: unknown, db: Db = prisma) {
  edition(editionId);
  const q = annotationQuerySchema.parse(raw);
  const rows: any[] = await db.$queryRaw`SELECT * FROM "quran_annotations" WHERE "userId"=${userId} AND "editionId"=${editionId} ORDER BY "updatedAt" DESC LIMIT 2000`;
  const items = rows.map(out).filter(r =>
    (!q.surahId || r.verseKey.startsWith(`${q.surahId}:`)) &&
    (q.type === 'all' || (q.type === 'highlights' ? r.color !== null : r.comment !== '')) &&
    (q.tag === undefined || r.tag === q.tag) && (!q.color || r.color === q.color));
  const tags = [...new Set(rows.map(r => r.tag).filter(Boolean))].sort();
  return { items, tags, colors: ANNOTATION_COLORS };
}

export async function upsertAnnotation(userId: string, editionId: string, raw: unknown, db: Db = prisma) {
  edition(editionId);
  const v = annotationInputSchema.parse(raw);
  const rows: any[] = await db.$queryRaw`INSERT INTO "quran_annotations" ("id","userId","editionId","verseKey","wordPosition","color","comment","tag","updatedAt")
    VALUES (${randomUUID()},${userId},${editionId},${v.verseKey},${v.wordPosition},${v.color},${v.comment},${v.tag},CURRENT_TIMESTAMP)
    ON CONFLICT ("userId","editionId","verseKey","wordPosition") DO UPDATE SET "color"=EXCLUDED."color","comment"=EXCLUDED."comment","tag"=EXCLUDED."tag","updatedAt"=CURRENT_TIMESTAMP
    RETURNING *`;
  return out(rows[0]);
}

export async function deleteAnnotation(userId: string, id: string, db: Db = prisma) {
  const n = await db.$executeRaw`DELETE FROM "quran_annotations" WHERE "id"=${id} AND "userId"=${userId}`;
  if (!n) throw new AppError('Annotation not found', 404, ErrorCodes.NOT_FOUND);
  return { deleted: true };
}
