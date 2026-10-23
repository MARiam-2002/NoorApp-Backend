/** User-reviewed opening excerpts. Full recordings and existing defaults remain unchanged. */
import { AZAN_SOUND_OPTIONS, type AzanSoundOption } from './azan-sounds';
export const DEFAULT_TAKBIR_SOUND_ID = 'takbir_nasser_al_qatami_v1';
const checksums: Record<string, { mp3Sha256: string; cafSha256: string }> = {
  "takbir_abul_ainain_shuaisha_v1": {
    "mp3Sha256": "c0858de14827bc9323e0a85933c2c90a3e41c89d5f673b1843de145712b3111c",
    "cafSha256": "9ab4c88c199b5bb3ee3973864b5635a6f543332a9787806a9cde50a515ba7bae"
  },
  "takbir_ahmed_al_trabulsi_v1": {
    "mp3Sha256": "b31196be8f3b724e698433a903ec0ef70d73f1aea749d4607be31359bc216db9",
    "cafSha256": "8d34898b117565bae75e8581ffa0a4a5bec2a79fc85df979cd85f167254f026b"
  },
  "takbir_ali_mulla_v1": {
    "mp3Sha256": "e1c1fffab5144d4304884d51b30e2382dfc2398876d92ad9ef99c31667e03de5",
    "cafSha256": "4c087e2bee55a9b0bc488904a1febba455fcf44d437cf13283d9b0500739213d"
  },
  "takbir_assem_bukhari_v1": {
    "mp3Sha256": "3dc0760154e8a0fcdc81f324f03abf131b1fe8b37e9fe0d95d17298aab6e79f4",
    "cafSha256": "acb9bffa1ad0c01cdd37348168d3601067086c2383765937478062b8acdfa46c"
  },
  "takbir_mishary_alafasy_2_v1": {
    "mp3Sha256": "704b75da5270b2aeec984679c3784d03c2b82e616352af755bb8ffa5193ee540",
    "cafSha256": "f3a9a8e59e9c239a5206a49a86a37ab4b4bc98018fac4640b2efcb2a30a20c6e"
  },
  "takbir_mishary_alafasy_3_v1": {
    "mp3Sha256": "4fba1d80194282ca755eb716cbbe954cacb40884b456789d6a3743911ab29dd8",
    "cafSha256": "6bbcdcf40ad84c637a5e7eb16ce6686d1ec6951083a03ae8be51f070fb4d6b99"
  },
  "takbir_mishary_alafasy_v1": {
    "mp3Sha256": "dba06616300ee397a069c4979755430ff786c7689d6916a08840f6d2d43e12ae",
    "cafSha256": "2fcf8e9a03257b3501575885e701bb55d73e0ecb9b3b3cc90e4a4ad18e53e8f5"
  },
  "takbir_mohamed_minshawi_v1": {
    "mp3Sha256": "6df1aedc660e76bb1e9656104edb9ad89cf8f045dcf78fbc67e6b41a15b96224",
    "cafSha256": "096ffe51e2503481a8d74792c196427e0f11baf7c684255251ed0eeff32f8a18"
  },
  "takbir_mohamed_rifaat_v1": {
    "mp3Sha256": "5240dd13e4780ce75c689e8d33b3a4702abe2d934c75d9cea44c1956a04db988",
    "cafSha256": "3ff30cc5f24d2d42dd83ca24c0266f696758e746d20933a5584fdb171afd5b68"
  },
  "takbir_mohammed_kabbara_v1": {
    "mp3Sha256": "9f27e1a896e9aa8b2690f86b2e2635ef5181ce3de5b3924d9f1c497def76426f",
    "cafSha256": "76995550577dc59528fc69345b6ec38e450e769f38697d10a3f23319e5345345"
  },
  "takbir_naji_qazzaz_v1": {
    "mp3Sha256": "3dc8798956264d8fa1698fb2adfbeb2494897ff1853e750c6a677bffe82e408e",
    "cafSha256": "5e6be6d9641c30682d81d8de006e6d0477a2eb6647cd4957106959bab98b65ca"
  },
  "takbir_nasser_al_qatami_v1": {
    "mp3Sha256": "dd695eb5020806d03cefc92bca69fce52efe814f98889a33a5cc03036d88a38e",
    "cafSha256": "feeae64085824ed569e0a72e35420d73fa7f8d58833a0898105d6d00f830caf2"
  },
  "takbir_noureddine_hamza_v1": {
    "mp3Sha256": "f5279da400785b360ee61956fa45e994f01119d807b9e822fec0454eb4ee4aea",
    "cafSha256": "ae60d9cde36d31cd1ae01ab986bfee5cc74a9bf08a066caf454ec542c4f3cb3f"
  },
  "takbir_wadi_al_yamani_v1": {
    "mp3Sha256": "3e2ba1acd5e7a3837aabad8ce7f0b4104114acf22d3f11a79011ff73a4d360f3",
    "cafSha256": "85f087e0e066e9b0886ebfb43b78c46bb0652c3ab4c3e0a1998432775ee45124"
  }
};
const reviewed = [
  {
    "sourceId": "abul_ainain_shuaisha",
    "id": "takbir_abul_ainain_shuaisha_v1",
    "durationSeconds": 4.013107
  },
  {
    "sourceId": "ahmed_al_trabulsi",
    "id": "takbir_ahmed_al_trabulsi_v1",
    "durationSeconds": 8.195692
  },
  {
    "sourceId": "ali_mulla",
    "id": "takbir_ali_mulla_v1",
    "durationSeconds": 16.269093
  },
  {
    "sourceId": "assem_bukhari",
    "id": "takbir_assem_bukhari_v1",
    "durationSeconds": 15.248889
  },
  {
    "sourceId": "mishary_alafasy",
    "id": "takbir_mishary_alafasy_v1",
    "durationSeconds": 5.5878
  },
  {
    "sourceId": "mishary_alafasy_2",
    "id": "takbir_mishary_alafasy_2_v1",
    "durationSeconds": 16.658209
  },
  {
    "sourceId": "mishary_alafasy_3",
    "id": "takbir_mishary_alafasy_3_v1",
    "durationSeconds": 19.109909
  },
  {
    "sourceId": "mohamed_minshawi",
    "id": "takbir_mohamed_minshawi_v1",
    "durationSeconds": 12.395692
  },
  {
    "sourceId": "mohamed_rifaat",
    "id": "takbir_mohamed_rifaat_v1",
    "durationSeconds": 9.784308
  },
  {
    "sourceId": "mohammed_kabbara",
    "id": "takbir_mohammed_kabbara_v1",
    "durationSeconds": 16.631202
  },
  {
    "sourceId": "naji_qazzaz",
    "id": "takbir_naji_qazzaz_v1",
    "durationSeconds": 5.470091
  },
  {
    "sourceId": "noureddine_hamza",
    "id": "takbir_noureddine_hamza_v1",
    "durationSeconds": 13.279002
  },
  {
    "sourceId": "wadi_al_yamani",
    "id": "takbir_wadi_al_yamani_v1",
    "durationSeconds": 18.491497
  },
  {
    "sourceId": "nasser_al_qatami",
    "id": "takbir_nasser_al_qatami_v1",
    "durationSeconds": 13.22
  }
] as const;
const extraSourceNames: Record<string, [string, string]> = {
  abul_ainain_shuaisha: ['أبو العينين شعيشع', 'Abul Aynayn Shuaisha'],
  ahmed_al_trabulsi: ['أحمد الطرابلسي', 'Ahmed Al Trabulsi'],
  assem_bukhari: ['عاصم بخاري', 'Assem Bukhari'],
  mohammed_kabbara: ['محمد صلاح الدين كبارة', 'Mohammed Salahuddin Kabbara'],
  naji_qazzaz: ['ناجي قزاز', 'Naji Qazzaz'],
  noureddine_hamza: ['نور الدين حمزة', 'Noureddine Hamza'],
  wadi_al_yamani: ['وديع اليمني', 'Wadi Al Yamani'],
};
function localRecordingMetadata(id: string): AzanSoundOption {
  const names = extraSourceNames[id];
  if (!names) throw new Error('Unknown local source: ' + id);
  return { id, nameAr: names[0], nameEn: names[1], muezzin: names[1], muezzinAr: names[0], muezzinEn: names[1],
    descriptionAr: '', descriptionEn: '', isFamousVoice: true, category: 'famous_contemporary',
    audioUrl: '', previewUrl: '', mediaFile: id + '.mp3', format: 'mp3', provider: 'assabile_selfhosted',
    source: 'Excerpt of existing Noor local recording: assets/azan/' + id + '.mp3', available: true,
    durationSeconds: null, streamingAllowed: true, selfHostingAllowed: true, commercialUseAllowed: false,
    license: { spdxOrName: 'none', licenseUrl: null, attributionRequired: true,
      attributionText: names[1] + ' — excerpt of existing Noor recording; no additional license verified by this edit.',
      commercialUseAllowed: false, sourcePageUrl: '' } };
}
export const TAKBIR_SOUND_OPTIONS = reviewed.map(clip => {
  const original = AZAN_SOUND_OPTIONS.find(voice => voice.id === clip.sourceId) ?? localRecordingMetadata(clip.sourceId);
  return { ...original, ...checksums[clip.id], id: clip.id, sourceAzanSoundId: clip.sourceId,
    nameAr: 'تكبيرات قصيرة — ' + original.nameAr, nameEn: 'Short takbir — ' + original.nameEn,
    descriptionAr: 'مقطع افتتاحي قصير من الأذان، تمت مراجعته قبل إضافته.',
    descriptionEn: 'Reviewed opening excerpt of the original Adhan recording.',
    mediaFile: clip.id + '.mp3', nativeSound: clip.id, iosSoundFile: clip.id + '.caf',
    durationSeconds: clip.durationSeconds, isDefault: clip.id === DEFAULT_TAKBIR_SOUND_ID,
    audioUrl: '', previewUrl: '', reviewStatus: 'USER_APPROVED' as const };
});
export function getTakbirSoundById(id: string) { return TAKBIR_SOUND_OPTIONS.find(s => s.id === id); }
