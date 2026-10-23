# Mahmoud Ali Al-Banna — Quran recitation

The backend adds an entry to `GET /api/v1/quran/reciters`. Existing reader IDs and the Alafasy default remain unchanged. No database migration is required.

- Stable `id` and `code`: `Mahmoud_Ali_Al_Banna`
- Arabic label: `محمود علي البنا`
- English label: `Mahmoud Ali Al-Banna`
- Style: `Murattal`
- Source: https://everyayah.com/data/mahmoud_ali_al_banna_32kbps
- `resourceId` is optional and absent for this EveryAyah-only reader. Do not require or invent a numeric ID.

Populate the reader picker from the API and refresh cached catalogs. Preserve existing selections. Store and send the stable string ID, including through the existing reading preferences contract.

Use `GET /api/v1/quran/audio?surahId=2&ayahNumber=255&reciterId=Mahmoud_Ali_Al_Banna`; play the returned `data.audioUrl`. Direct EveryAyah playback uses the existing `serverUrl` contract with six-digit filenames, e.g. `002255.mp3`. No full-surah MP3 URL is supplied.

Cache downloaded audio by reader ID, surah and ayah. Changing reader must not reuse another reader's cached audio or interrupt progress tracking. Handle network failure with retry; never silently play a different reader under this label.

Verify the picker, saved selection after restart, verse navigation, repeat playback, downloading, and reader switching on a real device. Check Al-Fatihah 1:1, Ayat Al-Kursi 2:255, and An-Nas 114:6. Backend URL checks are not a substitute for device playback verification.
