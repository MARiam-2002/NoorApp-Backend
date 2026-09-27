# Backend reminder timing fix — note for Flutter (2026-09-27)

**TL;DR:** FCM backup reminders now arrive **on time** (within ~1 minute), never early.
No API, endpoint, or FCM payload field changed. Flutter only needs to make sure the
existing duplicate-prevention rule (Azan handoff §8) is really implemented, because the
FCM backup and your local alarm will now land in the **same minute**.

---

## What was wrong (from Railway logs, 26–27 Sep)

| Problem | Example (Cairo) |
|---|---|
| "حان الآن موعد أذان" FCM arrived **before** the Azan | Dhuhr 12:47 → FCM at 12:40 (7 min early) |
| "اقترب موعد صلاة" (pre 15) arrived up to 12 min early | Dhuhr pre → 12:20 instead of 12:32 |
| Fajr Azan FCM **never sent** on both days | pre-reminder logic swallowed the Azan push |
| Khatmah / Mulk / Duha / Qiyam FCM up to 12 min early | Khatmah 05:31 → sent 05:20 |
| No TTL — an offline phone could get an old Azan hours later | — |

## What the backend does now

- Reminders are checked **every minute** (in-process scheduler; the 10-min Railway cron stays as a safety net).
- **Azan (`PRAYER_AZAN` / `JUMUAH`)**: sent at the Azan minute, never before. If a minute is missed (deploy), catch-up is allowed for up to 10 minutes.
- **Pre-prayer (`PRE_PRAYER`)**: sent exactly `preReminderMinutes` before the prayer (catch-up at most half the lead time, e.g. ≤7 min for 15).
- **Mulk / Duha / Qiyam / Khatmah**: sent at the user's HH:mm, never before.
- **Salawat**: unchanged interval behaviour.
- **FCM TTL** (Android `ttl` + APNs `apns-expiration`): Azan 15 min, pre-prayer until prayer time, Mulk/Duha/Qiyam/Khatmah 60 min, Salawat 30 min. Expired pushes are dropped by FCM, not delivered late.
- APNs headers now include `apns-priority: 10` and `apns-push-type: alert`.

Simulation with the new rules (Cairo, 26 Sep, pre = 15):

| Prayer | Azan | Pre sent | Azan FCM sent |
|---|---|---|---|
| Fajr | 05:19 | 05:04 | 05:19 |
| Dhuhr | 12:47 | 12:32 | 12:47 |
| Asr | 16:12 | 15:57 | 16:12 |
| Maghrib | 18:47 | 18:32 | 18:47 |
| Isha | 20:04 | 19:49 | 20:04 |

## What Flutter must check

1. **Dedupe FCM vs local alarm (Azan handoff §8 — mandatory).** Both now fire in the same minute.
   Use `data.occurrenceKey` / `data.dedupeKey` (+ `data.source == "FCM_BACKUP"`). If the local
   alarm for that prayer/date already fired (or is scheduled within ~2 minutes), suppress the FCM
   sound/UI. Otherwise the user hears the Azan twice.
2. **Local alarms are still the source of truth.** If a user reports a late local alarm, that is
   device-side: `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM` not granted, battery optimisation, or
   OEM background kill (Xiaomi, Oppo, Samsung, …). Use `AndroidScheduleMode.exactAllowWhileIdle`
   and prompt for "ignore battery optimisations" on OEMs that need it.
3. No code change is required for payload parsing — all fields are the same.

---

## Worldwide prayer-time accuracy (same date)

`GET /prayers/today|schedule` response **shape is unchanged**; some **values** are now correct where
they used to be wrong:

| Area | Before | Now |
|---|---|---|
| Latitude above 48° (UK, Germany north, Scandinavia, Canada) in summer | Isha and Fajr at the same minute (e.g. London 21 Jun: 01:02 / 01:02) | Recommended high-latitude rule (London 21 Jun: Isha 22:25, Fajr 03:40). Below 48° (all MENA) nothing changed. |
| Polar circle (northern Norway / Sweden / Finland, Alaska) | Calculation crashed (`Invalid time value`) — schedule endpoint failed | Nearest-latitude resolution; valid times every day |
| Umm al-Qura (`MAKKAH`) in Ramadan | Isha = Maghrib + 90 | Isha = Maghrib + 120 (official) |
| Calculation methods | 6 | 14 — added `DUBAI`, `QATAR`, `KUWAIT`, `TURKEY`, `SINGAPORE`, `KEMENAG`, `UOIF`, `MOONSIGHTING` (previously these silently fell back to Egyptian) |
| Isha / pre-reminder crossing midnight | FCM backup could be skipped or carry the wrong date | Handled (FCM `date` = the prayer's own local day) |

**Flutter action:**

1. The method picker is driven by `GET /azan/calculation-methods`; it will now show 14 entries.
   If the list is hard-coded anywhere, switch to the API list (or add the 8 new ids).
   Recommended UX (Muslim Pro / Athan style): when a user first sets a location, pre-select the
   method for that country (`regionHint`), still editable.
2. Offline `adhan_dart` fallback must use the same rules, otherwise the local alarm and the server
   disagree for users above 48° / in the polar circle / in Ramadan with Umm al-Qura:
   - `params.highLatitudeRule = HighLatitudeRule.recommended(coordinates)`
   - `params.polarCircleResolution = PolarCircleResolution.aqrabBalad`
   - `MAKKAH` + Ramadan (Umm al-Qura calendar month 9) → `params.ishaInterval = 120`
   - Method mapping for the 8 new ids is in `ADHAN_FEATURE_FINAL.md` §6.
3. Prefer the Backend `schedule[].iso` (absolute instant) when scheduling alarms — do not rebuild
   the date from `time` (HH:mm), because at high latitudes Isha / Maghrib can fall after midnight.
