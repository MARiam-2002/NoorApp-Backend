# Noor — Fasting qada book + Excuse mode + streak reminder copy (Flutter handoff)

Date: 5 November 2026. Backend: done and tested (migration `20261106090000_fasting_qada_and_prayer_excuse`). Target release: the Ramadan build, frozen on **18 January 2027** (Ramadan 1448 starts about 8 February 2027).

Deploy order: the backend goes to **Staging** first. Build and test against Staging. Production gets the backend before the app release. If an endpoint returns 404 (old server), hide the feature.

## 0. Privacy rules (read first)

Both features touch private worship data. Many users of the qada book are women making up days missed during their period.

- The app **never sends a reason** (period, illness, travel, pregnancy). The backend has no field for it and refuses unknown fields.
- No analytics events, crash breadcrumbs or logs with qada counts, dates or excuse state.
- Notification text is neutral: "تذكير بصيام الغد". Never "قضاء", "حيض" or "عذر" in a notification or on the lock screen.
- The qada book has an optional **app lock** (fingerprint / face / PIN) with `local_auth`. Default on when the user first opens it, with a switch to turn it off.
- Nothing about qada or the excuse state appears on Home unless the user turns on "Show on Home" (default off).
- Do not cache these responses in plain shared preferences. Keep them in memory, or encrypted (`flutter_secure_storage`).
- Mariam: add one line to the privacy policy: qada day counts and excuse-mode dates are stored only to show your own statistics; no reason is stored; "Delete all qada data" removes them.

## 1. Qada book («دفتر القضاء»)

All endpoints need the access token. All responses are `private, no-store`. Every write returns the **full summary** below, so the screen just re-renders from the response.

| Method | Path | Body | Use |
| --- | --- | --- | --- |
| GET | `/fasting/qada` | — | Screen data (summary) |
| PUT / DELETE | `/fasting/qada/ramadan-days/{hijriYear}/{ramadanDay}` | — | During Ramadan: «لم أصم هذا اليوم» toggle. Idempotent |
| PUT / DELETE | `/fasting/qada/make-ups/{YYYY-MM-DD}` | — | «صمت يوم قضاء» for a local date (today or past). Idempotent |
| POST | `/fasting/qada/adjustments` | `{hijriYear, days, requestKey}` | Starting balance or correction. `days` may be negative (-400…400, not 0) |
| POST | `/fasting/qada/estimate` | `{fromHijriYear, toHijriYear, daysPerYear, apply?, requestKey?}` | «مش فاكرة كام يوم». `apply:false` = preview, `apply:true` saves one adjustment per year |
| POST | `/fasting/qada/fidya` | `{hijriYear, days, requestKey}` | Days covered by fidya (only for people who cannot fast) |
| GET | `/fasting/qada/events?limit=50&before=<ISO>` | — | History list, newest first; `nextBefore` for paging |
| DELETE | `/fasting/qada/events/{id}` | — | Delete one history entry (adjustment, fidya, any) |
| PATCH | `/fasting/qada/preferences` | `{expectedRevision?, remindersEnabled?, reminderTime?, fastingWeekdays?, hijriOffsetDays?}` | Settings |
| DELETE | `/fasting/qada` | — | «احذف كل بيانات القضاء» (confirm dialog first) |

- `requestKey`: a new UUID per user action, reused when the same action is retried (offline outbox, timeout). The server never counts it twice.
- `fastingWeekdays`: 0 = Sunday … 6 = Saturday. Default `[1, 4]` (Monday, Thursday).
- `hijriOffsetDays`: −2…+2, the same correction as the date widget («تعديل التاريخ الهجري»). Use one setting for the whole app and send it here too.
- `expectedRevision`: send `preferences.revision` from the last response; 409 means another device changed it → reload.

### Summary response (example, 6 Nov 2026)

```json
{
  "timezone": "Africa/Cairo",
  "remainingDays": 6,
  "overdueDays": 0,
  "madeUpTotalDays": 1,
  "extraMadeUpDays": 0,
  "byYear": [
    { "hijriYear": 1447, "ramadanMissedDays": 2, "adjustmentDays": 5, "owedDays": 7, "fidyaDays": 0,
      "madeUpDays": 1, "remainingDays": 6, "deadline": "2027-02-08", "overdue": false }
  ],
  "today":    { "date": "2026-11-06", "weekday": 5, "hijri": { "year": 1448, "month": 5, "day": 26 }, "canMakeUp": true, "blockedReason": null, "madeUp": false },
  "tomorrow": { "date": "2026-11-07", "weekday": 6, "hijri": { "year": 1448, "month": 5, "day": 27 }, "canMakeUp": true, "blockedReason": null, "madeUp": false },
  "ramadan": { "inRamadan": false, "ramadanDay": null, "currentHijriYear": 1448, "latestStartedRamadanYear": 1447,
               "nextRamadanHijriYear": 1448, "nextRamadanStart": "2027-02-08", "daysUntilNextRamadan": 94 },
  "pace": { "availableFastingDays": 94, "suggestedDaysPerWeek": 0.5, "feasible": true },
  "fidya": { "perDayAmount": null, "currency": null, "sourceNote": null, "coveredDays": 0 },
  "notes": { "delayAr": null, "intentionAr": "صيام القضاء فرض، فتكون نيته من الليل قبل الفجر.", "forgotCountAr": "إن لم تتذكر العدد فخذ بغالب ظنك، والأحوط أن تأخذ بالعدد الأكبر." },
  "sources": [ { "titleAr": "سورة البقرة ١٨٤", "textAr": "…" }, { "titleAr": "صحيح مسلم ٣٣٥", "textAr": "…" }, { "titleAr": "صحيح البخاري ١٩٥٠ ومسلم ١١٤٦", "textAr": "…" } ],
  "preferences": { "remindersEnabled": true, "reminderTime": "21:00", "fastingWeekdays": [1, 4], "hijriOffsetDays": 0, "revision": 2 },
  "privacy": { "reasonStored": false }
}
```

How the numbers work (all on the server): owed per Ramadan year = missed days + adjustments (never below 0), minus fidya days. Made-up days pay the **oldest year first**. `deadline` = first day of the next Ramadan. `overdue` = still owed after that day; then show `notes.delayAr`.

### Screens

1. **Main card**
   - Big number: `remainingDays`, written «عليكِ ٦ أيام» / «عليك ٦ أيام». Use the user's gender if the app has it; otherwise «المتبقي: ٦ أيام».
   - Under it: «باقي على رمضان ٩٤ يومًا» and the pace, «يوم كل أسبوعين تقريبًا», from `pace.suggestedDaysPerWeek` (0.5 → every 2 weeks, 1 → once a week, 2 → twice a week).
   - `pace.feasible == false` → «الأيام أكثر من الوقت المتبقي، ابدئي الآن وصومي ما تستطيعين».
   - Main button: **«صمتُ اليوم قضاءً»** → `PUT make-ups/{today.date}`. Hide it when `today.canMakeUp == false` and show why: RAMADAN «اليوم من رمضان», EID_AL_FITR / EID_AL_ADHA «يوم عيد، لا يجوز صيامه», TASHREEQ «من أيام التشريق، لا يجوز صيامها». When `today.madeUp == true`, show «تم ✓» with undo.
2. **Calendar** (month view): tap a past day → record or remove a make-up fast. Disable days whose `blockedReason` is not null. For other days, compute locally with the same Umm al-Qura + offset logic, or just try and show the 400 reason.
3. **Per-year list**: `byYear` rows «رمضان ١٤٤٧: ٦ أيام متبقية». Badge «تأخر» when `overdue`, plus `notes.delayAr` once at the top.
4. **Add days** («أضيفي أيامًا»): choose the Ramadan (Hijri year, default `ramadan.latestStartedRamadanYear`) + number → `POST adjustments` (positive). «تصحيح» → negative.
5. **«مش فاكرة كام يوم»**:
   1. From which year? (Hijri year list; you may also show the Gregorian year next to it).
   2. About how many days each year? (1–15 slider, default 7).
   3. Preview with `apply:false`, show `estimate.estimatedDays` and `notes.forgotCountAr`.
   4. Confirm with `apply:true` + `requestKey`.
   5. The user can correct any year later.
6. **Fidya** (inside "More"): «لا أستطيع الصيام بسبب مرض مزمن أو كِبَر سن» → number of days → `POST fidya`. Show `fidya.perDayAmount` × days when not null, else «اسألي عن قيمة الفدية المعلنة في بلدك».
   - Mariam sets the yearly value on the server: `FIDYA_PER_DAY_AMOUNT`, `FIDYA_SOURCE_NOTE`.
   - Pregnancy / nursing: **do not** route to fidya automatically. Show a note that scholars differ and link to Dar al-Ifta.
7. **During Ramadan** (`ramadan.inRamadan == true`): a small row on the Ramadan / Home screen: «لم أصم اليوم» → `PUT ramadan-days/{currentHijriYear}/{ramadanDay}`. A list of the month's days to fix past ones. The server refuses future days.
8. **Settings**:
   - reminder on/off;
   - time (default 21:00);
   - weekdays (chips: Sat … Fri; default Mon + Thu);
   - Hijri offset;
   - "Show on Home";
   - app lock;
   - «احذف كل بيانات القضاء».
9. **Sources and notes**: an «ℹ️» sheet with `sources` (Quran / hadith with numbers) and `notes.intentionAr`.

Error reasons (`details.reason` in 400/409 responses):

| reason | Arabic message |
| --- | --- |
| `FUTURE_DAY` | لا يمكن تسجيل يوم لم يأتِ بعد |
| `RAMADAN_NOT_STARTED` | رمضان هذه السنة لم يبدأ بعد |
| `RAMADAN` / `EID_AL_FITR` / `EID_AL_ADHA` / `TASHREEQ` | as in screen 1 |

### Reminder

- The server sends it (do not schedule a local copy). It goes out the evening before a chosen weekday at `reminderTime`, only when `remainingDays > 0`, tomorrow is allowed, and tomorrow is not already recorded.
- FCM `type: FASTING_REMINDER`, channel **`fasting_reminder_v1`** (default sound; already in `/devices/notification-channels`), `data.deepLink = /fasting/qada`, `data.fastDate`. Tap → open the qada book (after the app lock).
- Optional local addition: if the user taps «سأصوم غدًا» in the app, schedule a local suhoor alarm on the device (time from Fajr − 45 min). This one is local only.

## 2. Excuse mode («وضع العذر»)

| Method | Path | Body | Use |
| --- | --- | --- | --- |
| GET | `/prayers/excuse` | — | State |
| POST | `/prayers/excuse/start` | `{startDate?, muteReminders?}` | Turn on. `startDate` = today by default, up to 15 days back |
| POST | `/prayers/excuse/end` | `{endDate?}` | Turn off. `endDate` = the last excused day, default today |
| PATCH | `/prayers/excuse/current` | `{muteReminders}` | Change the mute switch |
| DELETE | `/prayers/excuse/periods/{id}` | — | Remove a period entered by mistake |

Response:
```json
{ "active": true,
  "current": { "id": "…", "startDate": "2026-11-04", "endDate": null, "effectiveEndDate": "2026-11-06", "days": 3, "open": true, "autoEnded": false, "muteReminders": false },
  "recent": [ … same shape, newest first … ],
  "todayDate": "2026-11-06", "timezone": "Africa/Cairo", "maxOpenDays": 40, "maxBackdateDays": 15,
  "privacy": { "reasonStored": false }, "titleAr": "وضع العذر", "descriptionAr": "…", "endedReminderAr": "إذا انتهى العذر قبل خروج وقت صلاةٍ فصلِّها." }
```

Rules:
- An open period ends by itself after 40 days. `autoEnded: true` means it did; show «انتهى وضع العذر تلقائيًا».
- 409 reasons: `ALREADY_ACTIVE`, `NOT_ACTIVE`, `OVERLAP`. 400: `FUTURE_DAY`, `TOO_OLD`.

UI:
- **Where**: Prayers screen menu (⋮) → «وضع العذر», and Account → Prayer settings. One line under the title: «للحيض والنفاس: يوقف حساب الصلوات دون أن تُحسب فائتة» (needs the scholar review).
- **On**: date picker «بدأ في» (default today), switch «إيقاف تنبيهات الصلاة مؤقتًا» (default **off**: many women still want to hear the Azan and repeat it).
- **While active**:
  - a soft banner on the Prayers screen: «وضع العذر مفعّل منذ ٣ أيام · إنهاء»;
  - the prayer checkboxes are disabled and show «متوقفة مؤقتًا», not 0/5;
  - Adhkar, dua, Quran listening and Duha/Qiyam reminders… stay normal, except that `muteReminders` also mutes Duha/Qiyam.
- **Ending**: «انتهى العذر» → `POST end` (endDate = today; allow picking yesterday). Then show `endedReminderAr` once.
- **muteReminders = true**: the server stops Azan backup, pre-prayer, Duha and Qiyam pushes. **Flutter must also pause its own local prayer notifications and the Fajr alarm** until the period ends, then reschedule them. Re-check on app start: if `active` is false, local schedules must be back on.
- **Statistics**: read the new fields:
  - `GET /journey/today` and `GET /dashboard`: `prayers.excused` / `dailyJourney.prayer.excused` and the prayer task's `excused` → show «متوقفة مؤقتًا». The day percentages already leave prayers out on excused days.
  - `GET /journey/progress`: `daily[].prayersExcused`.
  - Weekly summary: `categories[PRAYER].excusedDays`. The percentage is computed over non-excused days only.
  - Monthly heatmap: `cells[].prayersExcused` → paint the day neutral (grey / small dot), never "missed".
- **Ramadan link**: when the user ends an excuse period that overlaps Ramadan, ask: «تسجيل أيام رمضان من ٤ إلى ٩ في دفتر القضاء؟» → for each day, `PUT /fasting/qada/ramadan-days/{year}/{day}`. Ask; never add them silently.

## 3. Streak reminder copy (continuity)

The server reminder now names the streak at risk:
- «٧ أيام متتالية مع نور — خطوة بسيطة اليوم تكمل استمرارك 🌱»
- `data.streakDays` (string) is new. The channel and type are unchanged (`continuity_silent_v1`, `CONTINUITY`).

To do in the app:
- Make sure the continuity screen has the reminder switch («ذكّرني قبل ما السلسلة تنقطع») and the time choice (`reminderMinutesBeforeMidnight` 60–240) via `PATCH /continuity/preferences`. The data source already has `patchPreferences`.
- When `currentStreak` reaches 3 for the first time and reminders are off, show a one-time prompt «تحب نفكّرك قبل ما السلسلة تنقطع؟».

## 4. Tests (real devices, against Staging)

- [ ] Qada:
  - Add 7 days for 1447 → remaining 7.
  - «صمت اليوم» → 6; tap again → still 6.
  - Undo → 7.
- [ ] Calendar: Eid al-Adha 1447 (27 May 2026) is disabled; a refused date shows the Arabic reason.
- [ ] Estimate 1440–1446 × 7 → preview 49. Apply twice with the same requestKey → +49 once.
- [ ] Offline: record a make-up fast with no network → it syncs once later (requestKey / idempotent PUT).
- [ ] Reminder at 21:00 on Sunday for Monday. The notification text has no «قضاء». Tap → app lock → qada book.
- [ ] App lock on: notification tap and app switcher never show the qada screen before unlock.
- [ ] «احذف كل بيانات القضاء» → summary is empty; settings back to default.
- [ ] Excuse: turn on → Prayers screen shows paused; the heatmap day is neutral; the weekly prayer % does not drop.
- [ ] Excuse with mute → no Azan / pre-prayer / Fajr alarm from the server or the device. Turn off → local schedules return the same day.
- [ ] Excuse started in Ramadan and ended → prompt to add the days to the qada book.
- [ ] Old app version on the new server: nothing breaks (all fields are additive).
- [ ] Arabic and Western digits; RTL; largest font size; dark mode.

## 5. Needs the scholar review before release

All Arabic notes and labels above:
- `notes.*` and `sources`;
- the excuse-mode description;
- the fidya and pregnancy/nursing note;
- the "Ramadan days → qada" prompt.

Mariam will send the reviewer's corrections; the backend copy is changed in one place (`QADA_COPY`, `EXCUSE_COPY`).
