import { env } from '../config';
import { logger } from './logger';

type QfEnv = 'prelive' | 'production';

const PUBLIC_CONTENT_BASE = 'https://api.quran.com/api/v4';
const AUDIO_CDN_BASE = 'https://audio.qurancdn.com';

const OAUTH_URLS: Record<QfEnv, string> = {
  prelive: 'https://prelive-oauth2.quran.foundation',
  production: 'https://oauth2.quran.foundation',
};

const GATEWAY_URLS: Record<QfEnv, string> = {
  prelive: 'https://apis-prelive.quran.foundation/content/api/v4',
  production: 'https://apis.quran.foundation/content/api/v4',
};

type TokenCache = {
  accessToken: string;
  expiresAtMs: number;
};

let tokenCache: TokenCache | null = null;

function resolveQfEnv(): QfEnv {
  const raw = (env.QF_ENV || 'production').toLowerCase();
  return raw === 'prelive' || raw === 'pre-production' || raw === 'staging' ? 'prelive' : 'production';
}

export function hasQuranFoundationCredentials(): boolean {
  return Boolean(env.QF_CLIENT_ID?.trim() && env.QF_CLIENT_SECRET?.trim());
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 8_000,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getAccessToken(forceRefresh = false): Promise<string | null> {
  if (!hasQuranFoundationCredentials()) return null;

  const now = Date.now();
  if (!forceRefresh && tokenCache && tokenCache.expiresAtMs > now + 60_000) {
    return tokenCache.accessToken;
  }

  const qfEnv = resolveQfEnv();
  const tokenUrl = `${OAUTH_URLS[qfEnv]}/oauth2/token`;
  const basic = Buffer.from(
    `${env.QF_CLIENT_ID.trim()}:${env.QF_CLIENT_SECRET.trim()}`,
  ).toString('base64');

  const res = await fetchWithTimeout(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials&scope=content',
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    logger.warn('[QF] OAuth token request failed', {
      status: res.status,
      body: body.slice(0, 200),
    });
    return null;
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };
  if (!data.access_token) return null;

  tokenCache = {
    accessToken: data.access_token,
    expiresAtMs: now + Math.max(60, Number(data.expires_in ?? 3600)) * 1000,
  };
  return data.access_token;
}

async function qfFetchJson<T>(
  path: string,
  query?: Record<string, string | number | undefined>,
): Promise<T | null> {
  const qs = new URLSearchParams();
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null || v === '') continue;
      qs.set(k, String(v));
    }
  }
  const suffix = qs.toString() ? `?${qs}` : '';
  const pathWithQuery = `${path.startsWith('/') ? path : `/${path}`}${suffix}`;

  // Prefer authenticated Quran Foundation gateway when credentials exist.
  if (hasQuranFoundationCredentials()) {
    const qfEnv = resolveQfEnv();
    const base = GATEWAY_URLS[qfEnv];
    for (const forceRefresh of [false, true]) {
      const token = await getAccessToken(forceRefresh);
      if (!token) break;
      const res = await fetchWithTimeout(`${base}${pathWithQuery}`, {
        headers: {
          Accept: 'application/json',
          'x-auth-token': token,
          'x-client-id': env.QF_CLIENT_ID.trim(),
        },
      });
      if (res.status === 401 && !forceRefresh) continue;
      if (!res.ok) {
        logger.warn('[QF] authenticated content request failed', {
          path: pathWithQuery,
          status: res.status,
        });
        break;
      }
      return (await res.json()) as T;
    }
  }

  // Public Content API v4 (same family; works without console credentials).
  const publicRes = await fetchWithTimeout(`${PUBLIC_CONTENT_BASE}${pathWithQuery}`, {
    headers: { Accept: 'application/json' },
  });
  if (!publicRes.ok) {
    logger.warn('[QF] public content request failed', {
      path: pathWithQuery,
      status: publicRes.status,
    });
    return null;
  }
  return (await publicRes.json()) as T;
}

/** Strip HTML tags / footnotes for Flutter plain-text fields. */
export function stripHtml(input: string): string {
  return input
    .replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export function toAbsoluteAudioUrl(relativeOrAbsolute: string): string {
  const raw = relativeOrAbsolute.trim();
  if (!raw) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith('//')) return `https:${raw}`;
  return `${AUDIO_CDN_BASE}/${raw.replace(/^\//, '')}`;
}

export async function fetchQfTranslationByVerse(
  resourceId: number,
  verseKey: string,
): Promise<{ text: string; textHtml: string; resourceId: number; resourceName?: string } | null> {
  const data = await qfFetchJson<{
    translations?: Array<{ text?: string; resource_id?: number }>;
    meta?: { translation_name?: string };
  }>(`/quran/translations/${resourceId}`, { verse_key: verseKey });

  const row = data?.translations?.[0];
  if (!row?.text) return null;
  return {
    text: stripHtml(row.text),
    textHtml: row.text,
    resourceId: row.resource_id ?? resourceId,
    resourceName: data?.meta?.translation_name,
  };
}

export async function fetchQfTafsirByVerse(
  resourceIdOrSlug: string | number,
  verseKey: string,
): Promise<{ text: string; textHtml: string; resourceId: number; resourceName?: string; language?: string } | null> {
  const data = await qfFetchJson<{
    tafsir?: {
      text?: string;
      resource_id?: number;
      resource_name?: string;
      language_id?: number;
      translated_name?: { name?: string; language_name?: string };
    };
  }>(`/tafsirs/${resourceIdOrSlug}/by_ayah/${encodeURIComponent(verseKey)}`);

  const textHtml = data?.tafsir?.text;
  if (!textHtml) return null;
  return {
    text: stripHtml(textHtml),
    textHtml,
    resourceId: data?.tafsir?.resource_id ?? (Number(resourceIdOrSlug) || 0),
    resourceName: data?.tafsir?.resource_name ?? data?.tafsir?.translated_name?.name,
    language: data?.tafsir?.translated_name?.language_name,
  };
}

export async function fetchQfAudioByVerse(
  recitationId: number,
  verseKey: string,
): Promise<{ audioUrl: string; verseKey: string; recitationId: number } | null> {
  const data = await qfFetchJson<{
    audio_files?: Array<{ verse_key?: string; url?: string }>;
  }>(`/recitations/${recitationId}/by_ayah/${encodeURIComponent(verseKey)}`);

  const file = data?.audio_files?.[0];
  if (!file?.url) return null;
  return {
    audioUrl: toAbsoluteAudioUrl(file.url),
    verseKey: file.verse_key ?? verseKey,
    recitationId,
  };
}

export type QfResourceMaps = {
  translationIdByCode: Record<string, number>;
  tafsirIdByCode: Record<string, number | string>;
  recitationIdByCode: Record<string, number>;
};

/** Stable mapping from Flutter catalog codes → Quran Foundation resource IDs. */
export const QF_RESOURCE_MAP: QfResourceMaps = {
  translationIdByCode: {
    Sahih_International: 20,
    saheeh_international: 20,
    Yusuf_Ali: 22,
    yusuf_ali: 22,
    Pickthall: 19,
    pickthall: 19,
    French_Hamidullah: 31,
    french_hamidullah: 31,
    Turkish_Diyanet: 77,
    turkish_diyanet: 77,
    Malay_Basmeih: 39,
    malay_basmeih: 39,
    Malay_Basyuni_Imran: 39, // legacy alias → Basmeih
    Indonesian_Depag: 33,
    indonesian_depag: 33,
  },
  tafsirIdByCode: {
    Ibn_Kathir: 14,
    ibn_kathir: 14,
    'ar-tafsir-ibn-kathir': 14,
    Ibn_Kathir_Abridged: 169,
    Ibn_Kathir_En: 169,
    'en-tafisr-ibn-kathir': 169,
    Al_Tabari: 15,
    al_tabari: 15,
    Al_Qurtubi: 90,
    al_qurtubi: 90,
    Ibn_Kathir_Muyassar: 16,
    Al_Muyassar: 16,
    'ar-tafsir-muyassar': 16,
    Al_Baghawi: 94,
    al_baghawi: 94,
    Al_Saadi: 91,
    al_saadi: 91,
  },
  recitationIdByCode: {
    Mishary_Alafasy: 7,
    mishary_alafasy: 7,
    Abdul_Basit: 2,
    abdul_basit: 2,
    Mahmoud_Al_Husary: 6,
    mahmoud_al_husary: 6,
    Abdurrahman_As_Sudais: 3,
    abdurrahman_as_sudais: 3,
    Saud_Ash_Shuraym: 10,
    saud_ash_shuraym: 10,
    Muhammad_Siddiq_Al_Minshawi: 9,
    muhammad_siddiq_al_minshawi: 9,
    Minshawi_Murattal: 9,
    Minshawi_Mujawwad: 8,
  },
};

export function resolveTranslationResourceId(sourceId?: string): number {
  const fallback = 20;
  if (!sourceId) return QF_RESOURCE_MAP.translationIdByCode.Sahih_International ?? fallback;
  if (/^\d+$/.test(sourceId.trim())) return Number(sourceId);
  const mapped =
    QF_RESOURCE_MAP.translationIdByCode[sourceId] ??
    QF_RESOURCE_MAP.translationIdByCode[sourceId.replace(/-/g, '_')];
  if (mapped == null) {
    throw new Error(`Unknown translation source: ${sourceId}`);
  }
  return mapped;
}

export function resolveTafsirResourceId(sourceId?: string): number | string {
  if (!sourceId) return 14;
  if (/^\d+$/.test(sourceId.trim())) return Number(sourceId);
  const mapped =
    QF_RESOURCE_MAP.tafsirIdByCode[sourceId] ??
    QF_RESOURCE_MAP.tafsirIdByCode[sourceId.replace(/-/g, '_')];
  if (mapped == null) {
    throw new Error(`Unknown tafsir source: ${sourceId}`);
  }
  return mapped;
}

export function resolveRecitationResourceId(reciterId?: string): number | null {
  if (!reciterId) return QF_RESOURCE_MAP.recitationIdByCode.Mishary_Alafasy ?? 7;
  if (/^\d+$/.test(reciterId.trim())) return Number(reciterId);
  return (
    QF_RESOURCE_MAP.recitationIdByCode[reciterId] ??
    QF_RESOURCE_MAP.recitationIdByCode[reciterId.replace(/-/g, '_')] ??
    null
  );
}

export function verseKey(surahId: number, ayahNumber: number): string {
  return `${surahId}:${ayahNumber}`;
}
