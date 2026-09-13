import { logger } from './logger';

/**
 * Formatted Al-Qurtubi (classical Arabic) from QUL / Tarteel resource 23,
 * served via the spa5k/tafsir_api MIT mirror of that downloadable dataset.
 *
 * Why this exists:
 * Quran Foundation / api.quran.com resource 90 (`ar-tafseer-al-qurtubi`) often
 * returns plain text with missing spaces (upstream digitization). QUL resource 23
 * is the same classical work with proper word spacing. We prefer it for
 * Al_Qurtubi only — no heuristic Arabic word-splitting.
 *
 * Classical wording is public-domain (d. 671 AH). Packaging attribution:
 * QUL / Tarteel AI + spa5k/tafsir_api (MIT).
 */

const QUL_QURTUBI_SLUG = 'ar-tafseer-al-qurtubi';
/** Tarteel QUL resource id for Tafseer Al Qurtubi. */
export const QUL_QURTUBI_RESOURCE_ID = 23;

const CDN_BASES = [
  `https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/${QUL_QURTUBI_SLUG}`,
  `https://raw.githubusercontent.com/spa5k/tafsir_api/main/tafsir/${QUL_QURTUBI_SLUG}`,
] as const;

type CacheEntry = { text: string; expiresAtMs: number };
const ayahCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h warm-instance cache

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'User-Agent': 'NoorApp-Backend/1.0 (qurtubi-qul)',
      },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Escape plain source text for optional HTML display without inventing wording. */
export function plainTafsirToSafeHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  const paragraphs = escaped
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${p.replace(/\n/g, '<br/>')}</p>`);
  return paragraphs.length > 0 ? paragraphs.join('') : `<p>${escaped}</p>`;
}

/**
 * Fetch properly spaced Al-Qurtubi for one ayah from the QUL-sourced mirror.
 * Returns null on failure (caller should fall back to Quran Foundation).
 */
export async function fetchQulQurtubiByVerse(
  surahId: number,
  ayahNumber: number,
): Promise<{ text: string; textHtml: string; qulResourceId: number; editionSlug: string } | null> {
  if (!Number.isFinite(surahId) || !Number.isFinite(ayahNumber)) return null;
  if (surahId < 1 || surahId > 114 || ayahNumber < 1) return null;

  const key = `${surahId}:${ayahNumber}`;
  const now = Date.now();
  const cached = ayahCache.get(key);
  if (cached && cached.expiresAtMs > now) {
    return {
      text: cached.text,
      textHtml: plainTafsirToSafeHtml(cached.text),
      qulResourceId: QUL_QURTUBI_RESOURCE_ID,
      editionSlug: QUL_QURTUBI_SLUG,
    };
  }

  for (const base of CDN_BASES) {
    const url = `${base}/${surahId}/${ayahNumber}.json`;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) {
        logger.warn('[QurtubiQUL] ayah fetch non-OK', { url, status: res.status });
        continue;
      }
      const data = (await res.json()) as { text?: string };
      const text = typeof data?.text === 'string' ? data.text.trim() : '';
      if (!text) continue;

      ayahCache.set(key, { text, expiresAtMs: now + CACHE_TTL_MS });
      return {
        text,
        textHtml: plainTafsirToSafeHtml(text),
        qulResourceId: QUL_QURTUBI_RESOURCE_ID,
        editionSlug: QUL_QURTUBI_SLUG,
      };
    } catch (err) {
      logger.warn('[QurtubiQUL] ayah fetch failed', {
        url,
        message: (err as Error)?.message,
      });
    }
  }

  return null;
}

export function isAlQurtubiCatalogId(catalogId: string, resourceId?: number | string): boolean {
  const id = catalogId.trim();
  if (
    id === 'Al_Qurtubi' ||
    id === 'al_qurtubi' ||
    id === 'Al-Qurtubi' ||
    id === QUL_QURTUBI_SLUG ||
    id === '90' ||
    id === '23'
  ) {
    return true;
  }
  const n = Number(resourceId);
  return n === 90 || n === 23;
}
