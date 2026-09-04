# Flutter → Backend Status Reply

**Audience:** Noor Backend team  
**From:** Flutter / Noor app  
**Date:** 2026-09-04  
**Reply to:** Backend Data Contract Reply (Production-verified, 2026-09-04)  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1`

This is Flutter’s confirmation after implementing against your verified Production contract.

---

## 1) Overall verdict

| Layer | Status |
|-------|--------|
| Backend API contract (auth, dashboard, journey, Quran catalogs/content, Adhkar, challenges, tasbih, qibla, profile, notifications, prayers, azan-preferences, FCM token APIs) | **Accepted** — Production-verified shapes are wired on Flutter |
| Flutter client deliverables (auth, Home, Quran content UI, journey patches, Adhkar, challenges tab, tasbih, qibla, notifications, profile, **Local Azan v1**, azan prefs sync, FCM token register/unregister) | **Implemented** |
| Backend **ops** still open | See §3 (Firebase env, cron, reset-email QA) |

**No new required API work** is requested from Backend for Azan/FCM/prayers/Quran content. Remaining Backend items are **hosting / ops** only.

---

## 2) Flutter implementation confirmation (what we now call)

### Auth / session
- Sign-up, login, Google (`google_sign_in` `idToken`), refresh on `TOKEN_EXPIRED`, logout, guest mode, forgot/reset UI
- `INVALID_TOKEN` clears session; network/5xx on profile does not hard-logout

### Dashboard / journey
- `GET /dashboard` — all required sections rendered
- Prayer progress treated as fraction `0..1` (percent `>1` still accepted)
- Journey: today, progress, `PATCH` prayer / adhkar / sadaqah, quran-pages increment + outbox
- Challenges: list + claim-by-id + today claim on Home

### Quran
- Catalogs: `/quran/reciters|tafsirs|translations`
- Content: `/quran/audio` (`reciterId`), `/quran/tafsir` (`tafsirId`), `/quran/translation` (`translationId`)
- Browse/offline/reader, bookmarks, last-read, khatmah, `import-local`
- Reading prefs: wire key **`quranAutoScroll`** (legacy `quranAutoScrollEnabled` still accepted on read)

### Adhkar / tasbih / qibla / notifications / profile
- Adhkar home/categories/progress/favorites/search
- Tasbih today + increment (uses `dhikrEn` when locale is EN)
- Qibla calculate + **`GET /qibla/my-qibla`** available after location
- Notifications list / unread / read / read-all
- Profile me/update/password/location + reading-preferences

### Prayer / Azan (Flutter-owned alarms)
- Local Adhan engine is **source of truth for alarms** (as agreed)
- Prefs sync: `GET/PATCH /profile/azan-preferences` (incl. `fcmPrayerBackupEnabled`)
- Optional schedule cross-check endpoints are accepted; not used as alarm source

### FCM client
- `POST /devices/fcm-token` after login / token refresh
- `DELETE /devices/fcm-token` on logout
- Foreground handlers for data `type=AZAN` / `type=TEST`
- **Local Azan remains primary**; FCM is backup only

---

## 3) Remaining Backend ops (please complete)

| Priority | Item | Success check |
|----------|------|----------------|
| P0 | Set Firebase credentials on Vercel | `GET /health` → `fcm.configured: true` |
| P0 | External scheduler hitting `GET/POST /cron/prayer-reminders` ~every 10 minutes | Backup pushes leave the server for users with devices + `fcmPrayerBackupEnabled` |
| P1 | Confirm one real password-reset inbox delivery | User receives reset token email |

Firebase env (either form):

- `FIREBASE_SERVICE_ACCOUNT_JSON`  
  **or**
- `FIREBASE_PROJECT_ID` + `FIREBASE_CLIENT_EMAIL` + `FIREBASE_PRIVATE_KEY`

Optional: `CRON_SECRET` for the cron endpoint.

Until Firebase env is set: Flutter still registers/unregisters tokens; send may return `sent: 0` — that is expected.

---

## 4) Ownership (unchanged)

| Feature | Backend | Flutter |
|---------|---------|---------|
| Auth / JWT / dashboard / journey / notifications APIs | Owns | UI + token storage |
| Quran content + catalogs + audio URLs | Owns | Reader + player |
| Prayer schedule API | Owns | Display / optional sync |
| Azan preferences sync API | Owns | Settings UI + local cache |
| FCM token storage + send | Owns (needs Firebase env) | Token registration + handlers |
| Local Azan alarms / sound / permissions / offline | — | **Owns** |

---

## 5) Soft / optional asks (not blockers)

These are **not** release blockers. Ship only if easy:

1. Always return real `nameAr` / `surahNameAr` (never bare ids like `"3"`) — Flutter still patches locally when needed  
2. Prefer EN counterparts on journey/challenge/adhkar/tasbih payloads when available  
3. `GET /journey/badges` — Flutter CTA still “Coming soon” until product prioritizes badges UI  

---

## 6) What Flutter will do next (no Backend API dependency)

1. Real-device QA: Azan after kill/reboot, offline Azan, guest Azan, FCM after `fcm.configured=true`  
2. Store permission copy / release builds  
3. Product polish from `APP_ENHANCEMENTS` (non-blocking)

---

## Final status for Backend

- **Contract:** Flutter accepts your Production-verified reply.  
- **Client:** Local Azan v1 + prefs sync + FCM token client + remaining wired surfaces are in the app.  
- **Your action:** §3 ops only (Firebase + cron + one reset-email QA).  
- **Do not block** on new Azan/FCM API design — those endpoints are already correct.

Please reply when `health.fcm.configured` is `true` and cron is scheduled so we can finish push backup device QA.
