/**
 * «الفقه الميسر» course inside Learning (content public, progress private). Progress reuses learning_progress with
 * itemId "fiqh-muyassar-<lessonId>" (matches the table check) and collectionId "fiqh-muyassar"; the learning hub ignores those rows when it
 * builds "continue reading" for the regular collections.
 */
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { FIQH_BOOKS, FIQH_COURSE_META, FIQH_COURSE_VERSION, FIQH_GLOSSARY, FIQH_LESSONS } from '../shared/data/fiqh-course';

const COURSE_ID = FIQH_COURSE_META.id;
const itemKey = (lessonId: number) => `${COURSE_ID}-${lessonId}`;
type Lesson = (typeof FIQH_LESSONS)[number];

function assertCourse(courseId: string) {
  if (courseId !== COURSE_ID) throw new AppError('Course not found', 404, ErrorCodes.NOT_FOUND);
}
function findLesson(id: number): Lesson {
  const l = FIQH_LESSONS.find(x => x.id === id);
  if (!l) throw new AppError('Lesson not found', 404, ErrorCodes.NOT_FOUND);
  return l;
}

async function completedSet(userId?: string): Promise<Map<string, Date | null>> {
  if (!userId) return new Map();
  const rows: { itemId: string; completedAt: Date | null }[] = await prisma.$queryRaw`
    SELECT "itemId", "completedAt" FROM "learning_progress" WHERE "userId" = ${userId} AND "collectionId" = ${COURSE_ID}`;
  return new Map(rows.map(r => [r.itemId, r.completedAt]));
}

const lessonSummary = (l: Lesson, done: Map<string, Date | null>) => ({
  id: l.id, order: l.order, title: l.title, hasExplanation: l.explanation.length > 0, hasVideo: !!l.video,
  completed: !!done.get(itemKey(l.id)),
});

/** Card for the learning hub. */
export async function getFiqhCourseCards(userId?: string) {
  const done = await completedSet(userId);
  return [{
    id: COURSE_ID, titleAr: FIQH_COURSE_META.titleAr, titleEn: FIQH_COURSE_META.titleEn, subtitleAr: FIQH_COURSE_META.subtitleAr,
    version: FIQH_COURSE_VERSION, lessonCount: FIQH_LESSONS.length, completedCount: [...done.values()].filter(Boolean).length,
    availableBooks: FIQH_BOOKS.filter(b => b.available).length, totalBooks: FIQH_BOOKS.length,
  }];
}

export async function getFiqhCourse(courseId: string, userId?: string) {
  assertCourse(courseId);
  const done = await completedSet(userId);
  const byId = new Map(FIQH_LESSONS.map(l => [l.id, l]));
  return {
    ...FIQH_COURSE_META, version: FIQH_COURSE_VERSION,
    books: FIQH_BOOKS.map(b => ({ ...b, chapters: b.chapters.map(c => ({ titleAr: c.titleAr, lessons: c.lessonIds.map(id => lessonSummary(byId.get(id)!, done)) })) })),
    glossaryCount: FIQH_GLOSSARY.length,
  };
}

/** Glossary terms that occur in a text (longest first, no duplicates). */
function termsIn(text: string) {
  return FIQH_GLOSSARY.filter(g => text.includes(g.term));
}

export async function getFiqhLesson(courseId: string, lessonId: number, userId?: string) {
  assertCourse(courseId);
  const l = findLesson(lessonId);
  const done = await completedSet(userId);
  const i = FIQH_LESSONS.indexOf(l);
  const text = l.matnAr + '\n' + l.explanation.map(b => ('text' in b ? b.text : '')).join('\n');
  return {
    ...l, courseId: COURSE_ID, noticeAr: FIQH_COURSE_META.noticeAr,
    previousId: FIQH_LESSONS[i - 1]?.id ?? null, nextId: FIQH_LESSONS[i + 1]?.id ?? null,
    glossary: termsIn(text), completed: !!done.get(itemKey(l.id)),
  };
}

export function getFiqhGlossary(courseId: string) {
  assertCourse(courseId);
  return { version: FIQH_COURSE_VERSION, terms: FIQH_GLOSSARY };
}

/** Everything for offline use (refresh when `version` changes). */
export function getFiqhCourseAll(courseId: string) {
  assertCourse(courseId);
  return { ...FIQH_COURSE_META, version: FIQH_COURSE_VERSION, books: FIQH_BOOKS, lessons: FIQH_LESSONS, glossary: FIQH_GLOSSARY };
}

export const fiqhProgressSchema = z.object({ completed: z.boolean() }).strict();

export async function saveFiqhProgress(userId: string, courseId: string, lessonId: number, raw: unknown, db: any = prisma) {
  assertCourse(courseId);
  const v = fiqhProgressSchema.parse(raw);
  findLesson(lessonId);
  const key = itemKey(lessonId);
  if (v.completed) {
    await db.$executeRaw`INSERT INTO "learning_progress" ("userId", "itemId", "collectionId", "lastSectionIndex", "completedAt")
      VALUES (${userId}, ${key}, ${COURSE_ID}, 0, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId", "itemId") DO UPDATE SET "completedAt" = COALESCE("learning_progress"."completedAt", CURRENT_TIMESTAMP), "updatedAt" = CURRENT_TIMESTAMP`;
  } else {
    await db.$executeRaw`DELETE FROM "learning_progress" WHERE "userId" = ${userId} AND "itemId" = ${key}`;
  }
  const rows: { completedAt: Date | null }[] = await db.$queryRaw`SELECT "completedAt" FROM "learning_progress" WHERE "userId" = ${userId} AND "itemId" = ${key}`;
  const count: { n: number }[] = await db.$queryRaw`SELECT COUNT(*)::int AS n FROM "learning_progress" WHERE "userId" = ${userId} AND "collectionId" = ${COURSE_ID} AND "completedAt" IS NOT NULL`;
  return { courseId: COURSE_ID, lessonId, completed: !!rows[0]?.completedAt, completedCount: Number(count[0]?.n ?? 0), lessonCount: FIQH_LESSONS.length };
}
