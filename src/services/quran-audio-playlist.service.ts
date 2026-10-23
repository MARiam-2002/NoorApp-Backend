import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { listReciters, validateQuranAudioSelection } from './quran.service';

export const QURAN_AUDIO_CATALOG_VERSION = 1;

function metadata(reader: Awaited<ReturnType<typeof listReciters>>[number]) {
  const bitrate = Number(reader.serverUrl?.match(/_(\d+)kbps/)?.[1]);
  return {
    ...reader,
    riwaya: 'Hafs',
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
  return {
    schemaVersion: 1,
    catalogVersion: QURAN_AUDIO_CATALOG_VERSION,
    reciter,
    surahId: surah.id,
    totalAyahs: surah.totalAyahs,
    fromAyah, toAyah, qualityKbps,
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
