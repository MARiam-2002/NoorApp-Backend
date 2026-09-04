# Backend requirements — remaining only (Flutter perspective)

**Updated:** 2026-09-03  
Contract detail: [BACKEND_DATA_CONTRACT.md](./BACKEND_DATA_CONTRACT.md)  
Wire shapes for already-live APIs: [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md)  
Product UX (non-API): [APP_ENHANCEMENTS.md](./APP_ENHANCEMENTS.md)

Flutter base URL: `https://noor-app-backend-one.vercel.app/api/v1`

This file is the short checklist for the backend team. Everything Flutter already ships against is omitted — only gaps remain.

---

## 1) P0 — must fix now

| Item | Issue | Flutter impact |
|------|-------|----------------|
| Surah names | `nameAr` / `surahNameAr` sometimes `"3"` / `"6"` / `"7"` | Wrong titles on lists, khatmah, bookmarks (client patches locally) |
| `GET /dashboard` | Incomplete / unstable schedule or missing sections | Blank Home prayer card; missing journey / challenge / khatmah cards |
| Prayer `time` | Not 24h / ISO | Wrong next-prayer + ~24h countdown |
| `dailyJourney.adhkar.completed` | Non-boolean | Always shows incomplete |
| Journey prayer task | No `completed`/`total`/`progress` on `/journey/today` | Prayer card shows `—` |
| Password reset mail | Token email not delivered | Forgot/reset flow dead for users |

---

## 2) P1 — Flutter already calls these

Ship guide-shaped 200s. Client wiring exists.

| Area | Endpoints |
|------|-----------|
| Journey | `GET /journey/today`, `GET /journey/progress`, `PATCH /journey/adhkar`, `PATCH /journey/sadaqah`, `PATCH /journey/prayer` |
| Notifications | `GET /notifications`, `GET /notifications/unread-count`, `GET /notifications/:id`, `PATCH …/read`, `POST …/read-all` |
| Profile | `GET /profile/me`, `PATCH /profile/update`, `PATCH /profile/change-password`, `PUT /profile/location` |
| Adhkar sync | `GET/PUT /adhkar/progress`, `GET/POST/DELETE /adhkar/favorites`, `GET /adhkar/search` |
| Guest merge | `POST /quran/import-local` |
| Reader catalogs | `GET /quran/reciters`, `/quran/tafsirs`, `/quran/translations` |
| Search | `GET /quran/search` |

Keep stable (already live): auth, dashboard, challenge today claim, Quran browse/offline/bookmarks/last-read/khatmah, reading-preferences, adhkar home/categories, tasbih, `GET /qibla/calculate`, `POST /journey/quran-pages/increment`.

---

## 3) P2 — unlock Coming soon UI

| Area | Endpoints |
|------|-----------|
| Audio / tafsir / translation body | `GET /quran/audio`, `GET /quran/tafsir`, `GET /quran/translation` |
| Challenges tab | `GET /challenges`, `GET /challenges/today`, `GET /challenges/:id`, `POST /challenges/:id/claim` |
| Badges | On journey payloads or `GET /journey/badges` |
| Optional | reading-history, khatmah reset, bookmark note PATCH, `GET /qibla/my-qibla`, random ayah |
| Prefs | Persist `quranAutoScroll` on reading-preferences |
| Azan / FCM | See [AZAN_FEATURE.md](./AZAN_FEATURE.md) |

Also add EN counterparts for Arabic-only strings (journey, challenge, adhkar, notifications, tasbih) — see contract §4.

---

## 4) Checklist

- [ ] Surah names never bare ids
- [ ] Dashboard 200 + 5-prayer 24h schedule + boolean adhkar + fraction progress
- [ ] Journey today prayer counts + progress history + PATCH routes
- [ ] Notifications + profile + adhkar progress/favorites/search
- [ ] `POST /quran/import-local` + search + option catalogs
- [ ] Reset emails deliver
- [ ] Audio / tafsir / translation content for reader
- [ ] Challenges list + badges
- [ ] Optional EN fields + my-qibla + history/reset/note
