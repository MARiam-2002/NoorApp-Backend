# BACKEND_IMPLEMENTATION_REPORT.md

**Date:** 2026-09-25  
**App:** Noor (`com.noor.app`)  
**Spec:** `BACKEND_REQUIREMENTS_FOR_GOOGLE_PLAY_LAUNCH.md` + Azan/Flutter master task

---

## A. What was inspected

- Play launch requirements (P0 delete, P1 cron/URL, P2 SMTP)
- Auth delete path (`DELETE /auth/me`, `DeletedIdentity`, cascades)
- Azan catalog, preferences, media Range streaming
- Prayer-reminder cron, FCM, device tokens, idempotency
- Existing near-prayer assets + notification tones
- Production `/health`, cron auth, media, account-delete smoke
- Attached Arabic MP3 packs (prayer-events + near-prayer sources)

## B. What already existed

- Full Azan catalog + `/azan/media/:file` with Range
- Preferences: `azanEnabled`, `soundEnabled`, `vibrationEnabled`, `preReminderEnabled`, `preReminderMinutes`, `azanSoundId`/`voiceId`, `notificationSoundId`
- Cron `/cron/prayer-reminders` + Salawat in same job
- Account hard-delete + Play smoke tests
- Near-prayer resolver (`sc_near_auto` → per-prayer / Friday jumuah)
- Local-primary / FCM-backup architecture documented

## C. What was changed

1. **Arabic notification copy** aligned to product UI examples (`بعد N دقيقة…` / `حان الآن موعد أذان…`).
2. **Additive `eventType`** on FCM: `PRE_PRAYER_REMINDER` | `PRAYER_AZAN`.
3. **Pref aliases** for Flutter: `reminderMinutes`, `prePrayerReminderMinutes`, `prePrayerReminderEnabled`.
4. **Prayer-event audio pack** under `assets/prayer-events/` + catalog/media allow-list (`sc_event_*` including DUHA/QIYAM/FRIDAY).
5. Near-prayer MP3s refreshed from “اقترب موعد…” sources.
6. Media absolute URL fallback host → Railway (was Vercel).
7. Prior audit fixes retained: timing classifier, durable `azan_reminder_send_logs`, `preReminderMinutes` authority.

## D. Intentionally NOT changed

- Did **not** make FCM the primary exact Azan mechanism
- Did **not** add a second preferences schema
- Did **not** add cron scheduling for DUHA/QIYAM/FRIDAY (Flutter-local events)
- Did **not** put full Adhan MP3s as iOS notification sounds
- Did **not** remove `kind` / Title Case `prayer` fields
- Did **not** invent `NEAR_PRAYER` as a DB enum (still `type=AZAN`)

## E. Database migrations

| Migration | Purpose |
|-----------|---------|
| `20260925070000_azan_reminder_send_logs` | Unique `(userId, occurrenceKey)` for Azan/Near-Prayer FCM claims |

Applied on the configured Neon DB during audit; Railway must run `prisma migrate deploy` on deploy if separate.

## F. API changes

Additive only — see `BACKEND_CHANGELOG_FOR_FLUTTER.md`.

## G. Azan architecture

```text
Catalog (backend) → Prefs sync → Flutter caches full Azan
Flutter schedules PRE + PRAYER_AZAN locally (source of truth)
FCM cron = optional backup (fcmPrayerBackupEnabled)
```

## H. Local notification architecture (Flutter-owned)

Documented in `FLUTTER_BACKEND_INTEGRATION_GUIDE.md` §§15–20 (exact alarms, iOS &lt;30s, dedup, reschedule).

## I. FCM backup architecture

Single cron path; AZAN + SALAWAT; durable claim before send; invalid tokens pruned; per-user try/catch.

## J. Account deletion behavior

Verified production smoke: `DELETE /auth/me` → 200; login/refresh/google/me → 401; second delete → 401.

## K. Production URL verification

Canonical: `https://noorapp-backend-production.up.railway.app/api/v1`  
Code fallback in `azan-audio.service` updated away from Vercel.  
`PUBLIC_APP_ORIGIN` should remain Railway in env.

## L. SMTP verification

Production `/health` (2026-09-25): `email.configured: true`, `readyForDelivery: true`, provider `smtp`.  
Full mailbox round-trip not re-run in this session (ops P2).

## M. Security findings

| Finding | Severity | Notes |
|---------|----------|-------|
| Cron without secret → 401 | OK | Verified |
| Media path allow-list | OK | basename + map |
| FCM Admin not configured on Railway | **P1 ops** | `fcm.configured: false` — backup pushes no-op |
| Secrets in Flutter | N/A | Not introduced |

## N–O. Tests executed / results

| Command | Result |
|---------|--------|
| `npm run test:near-prayer` | **PASS** |
| `npm run test:account-delete` (Production) | **PASS** |
| `curl …/health` | email ready **true**; fcm **false** |
| Cron without auth | **401** |
| Media `sc_near_fajr` / `sc_near_jumuah` (earlier) | **200** |

## P. Remaining blockers

1. **Production FCM:** set Firebase Admin credentials for `noorapp-d5d7d` on Railway until `fcm.configured: true`.  
2. **Deploy** this codebase + migration to Railway for new copy/eventType/prayer-events media.  
3. Flutter still must implement local scheduling, cache, iOS playback, Android exact-alarm UX (not backend-deliverable).

## Q. Manual Flutter QA still required

- [ ] Prefs UI ↔ PATCH round-trip (1 / 5 / 10 / 15 minutes)  
- [ ] Local PRE + AZAN copy matches backend strings  
- [ ] Cached Azan plays offline at exact time  
- [ ] iOS: notification + separate full Azan playback  
- [ ] Android 14 exact-alarm permission path  
- [ ] No double fire local+FCM  
- [ ] FRIDAY / DUHA / QIYAM local-only events using `sc_event_*`  
- [ ] Account delete from in-app settings against Production  

---

## Status snapshot

| Area | Status |
|------|--------|
| Backend Play P0 (delete) | **PASS** (production smoke) |
| Azan catalog + prefs + media | **PASS** (code + tests) |
| Near-prayer / reminder minutes | **PASS** (tests) |
| Cron endpoint / auth | **PASS** |
| FCM delivery on production | **BLOCKED** (`fcm.configured: false`) |
| Flutter local Azan | **Flutter action required** |
