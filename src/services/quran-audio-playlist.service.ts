import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { listReciters, validateQuranAudioSelection } from './quran.service';

export const QURAN_AUDIO_CATALOG_VERSION = 3;

function metadata(reader: Awaited<ReturnType<typeof listReciters>>[number]) {
  const bitrate = Number(reader.serverUrl?.match(/(\d+)kbps/i)?.[1]);
  return {
    ...reader,
    riwaya: reader.riwaya ?? 'Hafs',
    /** Files are cut at Hafs (Kufi) verse boundaries for every reader, including the Warsh ones. */
    verseNumbering: 'HAFS' as const,
    /** Warsh readers: play surah by surah; do not highlight verses of the Warsh text with these files. */
    verseSyncWithMushaf: (reader.riwaya ?? 'Hafs') === 'Hafs',
    provider: 'everyayah',
    availableQualities: Number.isFinite(bitrate) && bitrate > 0 ? [bitrate] : [],
    filenamePattern: '{surah:03}{ayah:03}.mp3',
    ayahNumbering: 'one_based',
    supportsAyahPlayback: true,
    supportsFullSurahFile: false,
  };
}

export async function getQuranAudioCatalog() {
  return {
    schemaVersion: 1,
    catalogVersion: QURAN_AUDIO_CATALOG_VERSION,
    defaultReciterId: 'Mishary_Alafasy',
    reciters: (await listReciters()).map(metadata),
  };
}

/** Local URL generation only: no database access or per-verse upstream requests. */
export function getQuranAudioPlaylist(input: {
  surahId: number; reciterId?: string; fromAyah?: number; toAyah?: number; qualityKbps?: number;
  /** Memorization/listening repeat: each verse N times, then the whole range M times (1 = no repeat). */
  repeatEach?: number; repeatRange?: number;
}) {
  const fromAyah = input.fromAyah ?? 1;
  const { surah, reader } = validateQuranAudioSelection(input.surahId, fromAyah, input.reciterId);
  const toAyah = input.toAyah ?? surah.totalAyahs;
  validateQuranAudioSelection(input.surahId, toAyah, reader.id);
  const reciter = metadata(reader);
  if (toAyah < fromAyah || (input.qualityKbps != null && !reciter.availableQualities.includes(input.qualityKbps))) {
    throw new AppError('Invalid verse range or unavailable audio quality', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  const qualityKbps = reciter.availableQualities[0] ?? null;
  const repeatEach = input.repeatEach ?? 1;
  const repeatRange = input.repeatRange ?? 1;
  const count = toAyah - fromAyah + 1;
  if (![repeatEach, repeatRange].every(n => Number.isInteger(n) && n >= 1 && n <= 50) || count * repeatEach * repeatRange > 5000) {
    throw new AppError('Repeat counts must be 1-50 and the playback sequence at most 5000 items', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  /** Indexes into `items`, in playback order, with the requested repeats applied. */
  const sequence: number[] = [];
  for (let r = 0; r < repeatRange; r++) for (let i = 0; i < count; i++) for (let e = 0; e < repeatEach; e++) sequence.push(i);
  return {
    schemaVersion: 1,
    catalogVersion: QURAN_AUDIO_CATALOG_VERSION,
    reciter,
    surahId: surah.id,
    totalAyahs: surah.totalAyahs,
    fromAyah, toAyah, qualityKbps,
    repeat: { each: repeatEach, range: repeatRange },
    sequence,
    // No guessed 000 file or extra basmala is inserted; items are numbered Quran verses.
    items: Array.from({ length: toAyah - fromAyah + 1 }, (_, offset) => {
      const ayahNumber = fromAyah + offset;
      const verseKey = `${surah.id}:${ayahNumber}`;
      return {
        verseKey, surahId: surah.id, ayahNumber,
        audioUrl: `${reader.serverUrl}/${String(surah.id).padStart(3, '0')}${String(ayahNumber).padStart(3, '0')}.mp3`,
        cacheKey: `quran-audio:v${QURAN_AUDIO_CATALOG_VERSION}:${reader.id}:${qualityKbps}:${verseKey}`,
      };
    }),
  };
}
