import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { env, ErrorCodes } from '../config';
import { LEARNING_CATALOG_VERSION, LEARNING_COLLECTIONS_DATA } from '../shared/data/learning-content';

/**
 * Learning hub («تعلّم مع نور»): prophet stories, seerah, aqeedah, asma al-husna, fiqh, tajweed, an-Nawawi's Forty.
 * Content is static and verified at build time (scripts/build-learning-content.ts). Production serves APPROVED
 * items only; LEARNING_SHOW_DRAFTS=true (Staging) also serves DRAFT items, marked `draft: true`.
 * Companions and morals already exist in Noor and are listed with their own endpoint.
 */
type Collection = (typeof LEARNING_COLLECTIONS_DATA)[number];
type Item = Collection['items'][number];

export const learningProgressSchema = z.object({
  lastSectionIndex: z.number().int().min(0).max(200),
  completed: z.boolean().optional(),
  quizScore: z.number().int().min(0).max(100).optional(),
  quizTotal: z.number().int().min(1).max(100).optional(),
}).strict().refine(v => (v.quizScore === undefined) === (v.quizTotal === undefined), 'quizScore and quizTotal go together')
  .refine(v => v.quizScore === undefined || v.quizScore <= v.quizTotal!, 'quizScore cannot exceed quizTotal');

export const learningOptions = { showDrafts: () => env.LEARNING_SHOW_DRAFTS };

/** Generated data is `as const`; while every item is DRAFT the literal type has no APPROVED member, so compare as string. */
const isApproved = (item: Item) => (item.review as { status: string }).status === 'APPROVED';
const visible = (item: Item) => isApproved(item) || learningOptions.showDrafts();

function findCollection(id: string): Collection {
  const c = LEARNING_COLLECTIONS_DATA.find(x => x.id === id);
  if (!c) throw new AppError('Section not found', 404, ErrorCodes.NOT_FOUND);
  return c;
}
function findItem(id: string): { collection: Collection; item: Item } {
  for (const collection of LEARNING_COLLECTIONS_DATA) {
    const item = collection.items.find(i => i.id === id);
    if (item && visible(item)) return { collection, item };
  }
  throw new AppError('Item not found', 404, ErrorCodes.NOT_FOUND);
}

type ProgressRow = { itemId: string; collectionId: string; lastSectionIndex: number; completedAt: Date | null; quizBestScore: number | null; quizTotal: number | null; updatedAt: Date };
function progressDto(row: ProgressRow | undefined, sectionCount: number) {
  if (!row) return null;
  return { lastSectionIndex: Math.min(row.lastSectionIndex, Math.max(0, sectionCount - 1)), completed: row.completedAt !== null,
    completedAt: row.completedAt ? new Date(row.completedAt).toISOString() : null, quizBestScore: row.quizBestScore, quizTotal: row.quizTotal,
    updatedAt: new Date(row.updatedAt).toISOString() };
}
async function loadProgress(userId: string | undefined, itemIds?: string[]): Promise<Map<string, ProgressRow>> {
  if (!userId) return new Map();
  const rows: ProgressRow[] = itemIds
    ? await prisma.$queryRaw`SELECT "itemId", "collectionId", "lastSectionIndex", "completedAt", "quizBestScore", "quizTotal", "updatedAt" FROM "learning_progress" WHERE "userId" = ${userId} AND "itemId" = ANY(${itemIds})`
    : await prisma.$queryRaw`SELECT "itemId", "collectionId", "lastSectionIndex", "completedAt", "quizBestScore", "quizTotal", "updatedAt" FROM "learning_progress" WHERE "userId" = ${userId} ORDER BY "updatedAt" DESC LIMIT 200`;
  return new Map(rows.map(r => [r.itemId, r]));
}

function itemSummary(collection: Collection, item: Item, progress: Map<string, ProgressRow>) {
  return { id: item.id, collectionId: collection.id, order: item.order, titleAr: item.titleAr, titleEn: item.titleEn,
    personAr: item.personAr, honorificAr: item.honorificAr, summaryAr: item.summaryAr, readingMinutes: item.readingMinutes,
    sectionCount: item.sections.length, hasQuiz: item.quiz.length > 0, draft: !isApproved(item),
    progress: progressDto(progress.get(item.id), item.sections.length) };
}

export async function getLearningHub(userId?: string) {
  const progress = await loadProgress(userId);
  return {
    catalogVersion: LEARNING_CATALOG_VERSION,
    showsDrafts: learningOptions.showDrafts(),
    collections: LEARNING_COLLECTIONS_DATA.map(c => {
      const items = c.items.filter(visible);
      return { id: c.id, order: c.order, kind: c.kind, titleAr: c.titleAr, titleEn: c.titleEn, descriptionAr: c.descriptionAr, methodAr: c.methodAr,
        existingEndpoint: c.existingEndpoint, itemCount: items.length, comingSoon: !c.existingEndpoint && items.length === 0,
        completedCount: items.filter(i => progress.get(i.id)?.completedAt).length };
    }),
    continueReading: [...progress.values()].filter(r => !r.completedAt).slice(0, 5).flatMap(r => {
      try { const { collection, item } = findItem(r.itemId); return [itemSummary(collection, item, progress)]; } catch { return []; }
    }),
  };
}

export async function getLearningCollection(collectionId: string, userId?: string) {
  const c = findCollection(collectionId);
  const items = c.items.filter(visible);
  const progress = await loadProgress(userId, items.map(i => i.id));
  return { id: c.id, kind: c.kind, titleAr: c.titleAr, titleEn: c.titleEn, descriptionAr: c.descriptionAr, methodAr: c.methodAr,
    existingEndpoint: c.existingEndpoint, comingSoon: !c.existingEndpoint && items.length === 0,
    items: items.map(i => itemSummary(c, i, progress)) };
}

export async function getLearningItem(itemId: string, userId?: string) {
  const { collection, item } = findItem(itemId);
  const progress = await loadProgress(userId, [item.id]);
  const visibleItems = collection.items.filter(visible);
  const at = visibleItems.findIndex(i => i.id === item.id);
  return { ...item, collection: { id: collection.id, titleAr: collection.titleAr, methodAr: collection.methodAr },
    draft: !isApproved(item),
    previousItemId: at > 0 ? visibleItems[at - 1]!.id : null, nextItemId: at >= 0 && at < visibleItems.length - 1 ? visibleItems[at + 1]!.id : null,
    progress: progressDto(progress.get(item.id), item.sections.length) };
}

/** Keeps the furthest section, the first completion time and the best quiz score. */
export async function saveLearningProgress(userId: string, itemId: string, raw: unknown) {
  const v = learningProgressSchema.parse(raw);
  const { collection, item } = findItem(itemId);
  if (v.lastSectionIndex >= item.sections.length) throw new AppError('lastSectionIndex is past the last section', 400, ErrorCodes.VALIDATION_ERROR);
  if (v.quizTotal !== undefined && v.quizTotal !== item.quiz.length) throw new AppError('quizTotal does not match this item', 400, ErrorCodes.VALIDATION_ERROR);
  const completed = v.completed === true;
  const pct = v.quizScore === undefined ? null : Math.round((v.quizScore / v.quizTotal!) * 100);
  await prisma.$executeRaw`INSERT INTO "learning_progress" ("userId", "itemId", "collectionId", "lastSectionIndex", "completedAt", "quizBestScore", "quizTotal")
    VALUES (${userId}, ${item.id}, ${collection.id}, ${v.lastSectionIndex}, ${completed ? new Date() : null}, ${pct}, ${v.quizTotal ?? null})
    ON CONFLICT ("userId", "itemId") DO UPDATE SET
      "lastSectionIndex" = GREATEST("learning_progress"."lastSectionIndex", EXCLUDED."lastSectionIndex"),
      "completedAt" = COALESCE("learning_progress"."completedAt", EXCLUDED."completedAt"),
      "quizBestScore" = CASE WHEN EXCLUDED."quizBestScore" IS NULL THEN "learning_progress"."quizBestScore" ELSE GREATEST(COALESCE("learning_progress"."quizBestScore", 0), EXCLUDED."quizBestScore") END,
      "quizTotal" = COALESCE(EXCLUDED."quizTotal", "learning_progress"."quizTotal"),
      "updatedAt" = CURRENT_TIMESTAMP`;
  const progress = await loadProgress(userId, [item.id]);
  return { itemId: item.id, collectionId: collection.id, progress: progressDto(progress.get(item.id), item.sections.length) };
}
