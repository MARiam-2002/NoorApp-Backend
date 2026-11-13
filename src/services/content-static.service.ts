import { getQuranStaticMeta } from './quran.service';
import { getAdhkarStaticMeta } from './adhkar.service';

/**
 * One lightweight probe for Flutter offline sync.
 * Compare local catalogVersion/contentHash → skip full download when unchanged.
 */
export async function getStaticContentManifest() {
  // `adhkar` is the 14-category pack every released app validates; `adhkarAll` (additive) is the full pack for apps
  // that download it with /adhkar/full-catalog?categories=all.
  const [quran, adhkar, adhkarAll] = await Promise.all([getQuranStaticMeta(), getAdhkarStaticMeta('legacy'), getAdhkarStaticMeta('all')]);
  return { quran, adhkar, adhkarAll };
}
