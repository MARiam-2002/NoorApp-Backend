# Backend requirements & app enhancements (Flutter perspective)

Contract source of truth: [FLUTTER_INTEGRATION_GUIDE.md](./FLUTTER_INTEGRATION_GUIDE.md) (synced to **2026-08-22** Quran Text Hygiene patch).

Flutter base URL: `https://noor-app-backend-one.vercel.app/api/v1`

This document lists (1) what the backend must fix or keep stable for the current app, and (2) what Flutter still needs from the API for the next feature pass. Product UX ideas that are not API-shaped live in [APP_ENHANCEMENTS.md](./APP_ENHANCEMENTS.md).

---

## 1) Broken / must-fix now

| Endpoint         | Issue                                                               | Flutter impact                                                                         |
| ---------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `GET /dashboard` | Returning **HTTP 500** for authenticated users (when last observed) | Home tab shows error + Retry; greeting / prayers / journey widgets never load from API |

Fix and redeploy so the guide envelope returns the 8 sections: `greeting`, `prayers`, `verseOfTheDay`, `hadithOfTheDay`, `dailyJourney`, `khatmah`, `dailyChallenge`, `utilities`.

---

## 2) Contracts Flutter now relies on (keep stable)

| Contract                           | Notes                                                                                                                                                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nested tokens                      | `data.tokens.{accessToken,refreshToken,expiresIn}` on sign-up / login / Google / refresh                                                                                                                                                                                                                                  |
| Auth profile                       | `provider`, `providerId`, `googleId` as documented                                                                                                                                                                                                                                                                        |
| Error envelope                     | `code` + either `errors[]` (Zod) or `details` (app/Prisma); never both as the sole source of field hints                                                                                                                                                                                                                  |
| `INVALID_TOKEN` on 401             | Flutter clears session and does **not** call refresh                                                                                                                                                                                                                                                                      |
| Dual-page counter                  | On Mushaf page advance: `POST /journey/quran-pages/increment` then `PATCH /quran/khatmah/progress` then `PUT /quran/last-read`                                                                                                                                                                                            |
| Quran Bismillah / BOM (2026-08-22) | For surahs `2..8` and `10..114`, ayah `#1` `textAr` must be verse body only (Bismillah stripped). Surah `1` keeps Bismillah in ayah 1. Surah `9` has no Bismillah. All `textAr` BOM-free (`U+FEFF` stripped server-side). Flutter renders decorative header via `surahId != 1 && surahId != 9` only — no client stripping |
| Reading preferences                | Authoritative on server: `GET/PATCH /profile/reading-preferences` (`quranFontSize` 12..60)                                                                                                                                                                                                                                |
| listAyahs `meta`                   | Flat `meta.page`, `meta.limit`, `meta.total`, … (not nested `meta.pagination`)                                                                                                                                                                                                                                            |

---

## 3) Already wired in Flutter — keep these stable

### Auth (public / session)

| Method | Path                    |
| ------ | ----------------------- |
| POST   | `/auth/sign-up`         |
| POST   | `/auth/login`           |
| POST   | `/auth/google`          |
| POST   | `/auth/refresh`         |
| POST   | `/auth/logout`          |
| GET    | `/auth/me`              |
| POST   | `/auth/forgot-password` |
| POST   | `/auth/reset-password`  |

### Home / challenge claim

| Method | Path                      |
| ------ | ------------------------- |
| GET    | `/dashboard`              |
| POST   | `/challenges/today/claim` |

### Quran / khatmah / journey / prefs

| Method          | Path                             | Auth                        |
| --------------- | -------------------------------- | --------------------------- |
| GET             | `/quran/surahs`                  | Public                      |
| GET             | `/quran/juz`                     | Public                      |
| GET             | `/quran/juz/:juzNumber/surahs`   | Public                      |
| GET             | `/quran/pages/:pageNumber`       | Public                      |
| GET             | `/quran/surahs/:id/ayahs`        | Public (start page resolve) |
| GET/POST/DELETE | `/quran/bookmarks` (+ `/:id`)    | Bearer                      |
| GET/PUT         | `/quran/last-read`               | Bearer                      |
| GET             | `/quran/khatmah/stats`           | Bearer                      |
| PATCH           | `/quran/khatmah/progress`        | Bearer                      |
| POST            | `/journey/quran-pages/increment` | Bearer                      |
| GET/PATCH       | `/profile/reading-preferences`   | Bearer                      |

### Tasbih / Qibla

| Method | Path                                 | Notes                                                                                       |
| ------ | ------------------------------------ | ------------------------------------------------------------------------------------------- |
| GET    | `/tasbih/today`                      | Implemented in datasource; Flutter is **local-first** and does not hydrate UI from this yet |
| POST   | `/tasbih/increment`, `/tasbih/reset` | Fire-and-forget sync                                                                        |
| PATCH  | `/tasbih/change-dhikr`               | Fire-and-forget sync                                                                        |
| GET    | `/qibla/calculate`                   | Enrichment; local compass is source of truth offline                                        |

---

## 4) Required for next Flutter features (not built in UI yet)

Ship these with guide-shaped 200 responses so Flutter can wire screens without contract thrash.

| Area                  | Endpoints                                                                                                                      | Flutter need                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| Full profile card     | `GET /profile/me`, `PATCH /profile/update`, `PATCH /profile/change-password`, `PUT /profile/location`                          | Account tab editable profile, LOCAL change-password, GPS save                           |
| My Qibla              | `GET /qibla/my-qibla`                                                                                                          | Compass using saved `latitude`/`longitude` without query params                         |
| Journey tab           | `GET /journey/today`, `GET /journey/progress`, `PATCH /journey/adhkar`, `PATCH /journey/sadaqah`, `PATCH /journey/quran-pages` | Replace Journey placeholder; keep dual-counter consistent with dashboard `dailyJourney` |
| Challenges tab        | `GET /challenges`, `GET /challenges/:id`, `POST /challenges/:id/claim`, `GET /challenges/today`                                | Full list/detail beyond Home claim card                                                 |
| Notifications         | Guide `/notifications/*` set (7 endpoints)                                                                                     | Bell unread count + list                                                                |
| Quran search / random | `GET /quran/search`, `GET /quran/ayahs/random`                                                                                 | Search UI + random ayah widgets                                                         |
| Reading history       | `GET/POST /quran/reading-history`                                                                                              | Optional session log                                                                    |
| Khatmah reset         | `POST /quran/khatmah/reset`                                                                                                    | "Start new khatmah" on استكمال الختمة                                                   |
| Bookmark note         | `PATCH /quran/bookmarks/:id`                                                                                                   | Edit note on favorites                                                                  |
| Surah detail          | `GET /quran/surahs/:surahId`                                                                                                   | Metadata-only screens if needed                                                         |
| Khatmah core          | `GET /quran/khatmah`                                                                                                           | If stats-only is insufficient for hero state                                            |

### Password-reset delivery (ops)

| Requirement                                                      | Why                                                                                   |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Email actually delivers reset token (or documented staging sink) | Flutter forgot/reset UI is live; without mail delivery users cannot complete the flow |
| Document deep-link scheme if email should open the app           | App currently accepts **manual token paste** on reset screen                          |

**Vercel (Brevo Free SMTP):** `EMAIL_PROVIDER=smtp`, `MAIL_HOST=smtp-relay.brevo.com`, `MAIL_PORT=587`, `MAIL_SECURE=false`, plus `MAIL_USER` / `MAIL_PASSWORD` from Brevo **SMTP & API**, and `MAIL_FROM` matching a **verified** Brevo sender. Deep link: `noorapp://auth/reset-password?token={{token}}`. API still never returns the raw token. See `.env.example` and `VERCEL_SETUP.md`.

### Multi-device Tasbih (product decision)

If server should win over local counts: expose reliable `GET /tasbih/today` and document merge rules. Today Flutter ignores remote values by design.

---

## 5) App enhancement backlog (backend-dependent)

- Challenges tab + claim reconciliation UI after local-first points.
- Journey / badges tab driven by journey progress + streak fields.
- Notifications bell.
- Azan / prayer alerts (see [AZAN_FEATURE.md](./AZAN_FEATURE.md)) — may need schedule or FCM later.
- Quran search + share ayah card.
- Profile location → My Qibla without re-prompting GPS every open.
- Server wallet / challenge points "synced vs pending" state.

---

## 6) Backend checklist

- [ ] `GET /dashboard` returns **200** (not 500) for valid Bearer tokens
- [ ] Quran public catalog/page routes return guide JSON with Aug-22 text hygiene
- [ ] Bookmarks / last-read / khatmah stats / progress work with Bearer
- [ ] Journey increment updates `dailyGoal.pagesReadToday` used by khatmah stats
- [ ] Reading-preferences GET/PATCH clamp `quranFontSize` 12..60
- [ ] Error envelope always includes stable `code` (+ Arabic-safe `message`)
- [ ] Forgot/reset password emails deliver tokens in staging/production
- [ ] Profile / journey / challenges / notifications / my-qibla endpoints ready for next Flutter pass
