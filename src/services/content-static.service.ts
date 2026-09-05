import { getQuranStaticMeta } from './quran.service';
import { getAdhkarStaticMeta } from './adhkar.service';

/**
 * One lightweight probe for Flutter offline sync.
 * Compare local catalogVersion/contentHash → skip full download when unchanged.
 */
export async function getStaticContentManifest() {
  const [quran, adhkar] = await Promise.all([getQuranStaticMeta(), getAdhkarStaticMeta()]);
  return { quran, adhkar };
}
