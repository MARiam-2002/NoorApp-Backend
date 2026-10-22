# Quran content checks — 22 October 2026

The reported Ayat al-Kursi word was a genuine backend content error. Six production adhkar records were corrected in place from `عَلِمَ` to `يَعْلَمُ`. See `FLUTTER_AYAT_AL_KURSI_TEXT_CORRECTION_2026.md` for offline-device propagation and remaining deployment requirements.

## Checks actually completed

- Read-only public-production comparison: all 6,236 verses, all 114 surahs, exactly one occurrence of each verse key; zero text differences against `prisma/data/quran-uthmani.json` after the API's documented opening-basmalah presentation adjustment.
- The comparison preserves diacritics. It normalizes only NFC, whitespace and BOM. It does not silently discard missing letters or vowels.
- All 93 live adhkar item texts matched the corrected source catalog; zero differences.
- Offline regression tests compare the whole Ayat al-Kursi, the complete Al-Ikhlas/Al-Falaq/An-Nas passages, the identified Quran excerpts in the supplications (20:114, 23:29, 43:13–14), and the quotation in the reference to 47:19. These comparisons explicitly allow Uthmani versus conventional spelling; they do not certify all vowel placement. All six Kursi source copies must equal the same corrected constant.
- `npm run test:adhkar-catalog` passed. This test runs in the Backend checks workflow on every push/PR.

Read-only production comparison can be repeated with:

```
npx tsx scripts/audit-live-quran-content.ts <report-output.json>
```

This downloads only the public catalogs, without an account, database access or notification sending. The script intentionally exits nonzero on differences; it never automatically overwrites religious content.

## What this does not establish

Matching an existing source is not independent authentication of that source. No qualified human review of every verse, religious quotation, hadith attribution, benefit statement or repetition count was performed by these tests. Warsh packages, recitation audio, platform fonts, screenshots, share-card layout, and old device caches were not covered by the 6,236-verse HTTP comparison. Source/catalog version 4 still needs a successful deployment before its new version is advertised to old clients.

Before claiming a religious-content review is complete, have an appropriately qualified Quran/content reviewer inspect the authoritative source and the final rendered client output. Keep a record of the source edition/version, change and reviewer. Generate Quran excerpts from that approved source wherever practical, keep the automated checks, and avoid hand-editing repeated verse copies independently.
