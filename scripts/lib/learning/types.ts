/**
 * Authored learning content (stories, tajweed lessons, fiqh lessons) for adults.
 *
 * Trust rules, enforced by scripts/build-learning-content.ts:
 * - Quran: cited by surah/ayah only. The build copies the exact text from prisma/data/quran-uthmani.json
 *   (the app's Quran text); a wrong reference fails the build.
 * - Hadith: Sahih al-Bukhari / Sahih Muslim only, cited by a verbatim phrase. The build finds the phrase in the
 *   pinned local editions (prisma/data/hadith, hashes in figure-story-sources-2026.json) and stores the excerpt
 *   with its standard number; a phrase that is not found, or found under another number, fails the build.
 * - Every section carries at least one Quran or hadith citation. Narrative stays inside what the citations say:
 *   no Israiliyyat, no invented names, dialogue or numbers.
 * - review is informational (DRAFT = not yet reviewed by a named scholar). Every item in the build is served.
 * - Quiz: write the correct option first (correctIndex 0 is fine); the build shuffles the options deterministically.
 */
import type { SahihCollection } from '../sahihayn-lookup';

export type QuranRef = { surah: number; from: number; to?: number };
export type HadithRef = { collection: SahihCollection; phrase: string; number: number };

export type SectionDef = {
  titleAr: string;
  paragraphsAr: string[];
  /** Optional reflection, shown under the heading «وقفة». */
  reflectionAr?: string;
  quran?: QuranRef[];
  hadith?: HadithRef[];
  /** Al-Arba'in an-Nawawiyyah hadith numbers (1-42), copied verbatim with an-Nawawi's own attribution. */
  nawawi?: number[];
};

export type QuizDef = { questionAr: string; optionsAr: string[]; correctIndex: number; explanationAr: string };

export type ReviewDef =
  | { status: 'DRAFT' }
  | { status: 'APPROVED'; reviewerAr: string; approvedAt: string; notesAr?: string };

export type ItemDef = {
  id: string;
  order: number;
  titleAr: string;
  titleEn: string;
  /** Prophet stories: «آدم», with honorific. */
  personAr?: string;
  honorificAr?: string;
  summaryAr: string;
  sections: SectionDef[];
  keyPointsAr: string[];
  quiz: QuizDef[];
  review: ReviewDef;
};

export type CollectionId = 'prophet-stories' | 'seerah' | 'companions' | 'aqeedah' | 'asma-husna' | 'fiqh' | 'tajweed' | 'nawawi-forty' | 'morals';

export type CollectionDef = {
  id: CollectionId;
  order: number;
  kind: 'STORY' | 'LESSON' | 'HADITH';
  /** Sections that already exist elsewhere in Noor are listed here and point to their own endpoint (no duplicate content). */
  existingEndpoint?: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  /** Method shown to users under «منهج هذا القسم». */
  methodAr: string;
  items: ItemDef[];
};
