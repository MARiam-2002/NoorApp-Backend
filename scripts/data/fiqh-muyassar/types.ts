/**
 * Editorial layer for «الفقه الميسر» lessons from منصة يَسِّر (fqh.me), used in Noor with the author's permission.
 *
 * explanation markup (one block per line, blank lines ignored):
 *   plain line            → paragraph
 *   "- text"              → bullet
 *   "1- text"             → numbered item (keeps the number)
 *   "@hadith:<id>"        → a hadith from FIQH_HADITH, shown with its reference (checked letter and vowel)
 * explanation null       → the sheikh added nothing to the book's text for this lesson.
 * reviewAr               → points a qualified reviewer must check before the lesson is marked reviewed (not sent).
 */
export type FiqhHadithDef = {
  leadAr: string; textAr: string; collection: 'bukhari' | 'muslim' | 'abudawud' | 'tirmidhi'; number: number; referenceAr: string;
};
export type FiqhEdit = { titleAr?: string; explanation: string | null; reviewAr?: string[] };
