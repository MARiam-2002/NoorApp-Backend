# Noor App — Auto Refresh Contract (2026) — Flutter Only

> **Audience:** Flutter team  
> **Send THIS FILE** for: when / how Home + رحلتي + related screens refresh without Socket.io  
> **Status:** Backend-ready · no new APIs required  
> **Production Base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`  
> **Related (do not replace):**  
> - Home binding → `FLUTTER_WORLDWIDE_FEATURES_FINAL.md` (Part H)  
> - Journey cards shape → `GET /journey/dashboard` (+ optional `FLUTTER_JOURNEY_SCREEN_HANDOFF_2026.md`)  
> - Azan / FCM payload detail → `FLUTTER_PRAYER_NOTIFICATIONS_CONTRACT.md`

---

## 0. Decision (read first)

| Question | Answer |
|----------|--------|
| Use **Socket.io / WebSocket**? | **No.** Do not add it for Home / Journey / nawafel / khatmah. |
| Why not? | Progress is **per-user** and changes from **this device’s** mutations (or time). Persistent sockets add Railway cost, reconnect bugs, and sticky-session complexity with zero UX gain. |
| What makes the app feel “live” in 2026? | **Optimistic UI** + **silent refetch** after mutations + **lifecycle / midnight / countdown** triggers. |
| Push while app is backgrounded? | Keep existing **FCM + local notifications**. Not WebSocket. |
| Multi-device later (phone + tablet)? | Optional: FCM **data** message `type: progress_updated` → refetch. Still no Socket. |

---

## 1. Two source-of-truth GETs

| Screen (AR) | One call | Do not fan-out |
|-------------|----------|----------------|
| **الرئيسية** (Home) | `GET /dashboard` | Do not call `/journey/today` + prayers + verse separately for Home |
| **رحلتي** (My Journey) | `GET /journey/dashboard` | Do not call `/today` + `/weekly-summary` + `/monthly-heatmap` + `/badges` just to paint the 4 cards |

Auth on both:

```http
Authorization: Bearer <access_token>
```

Standard envelope: `success` / `message` / `data` / `meta` / `timestamp` / `requestId`.

---

## 2. What must look “auto-updated” on each screen

### 2.1 Home — `GET /dashboard`

| UI | Path under `data` | Stale if you skip refresh after… |
|----|-------------------|----------------------------------|
| أهلاً، الاسم | `greeting.displayName` | profile name change |
| اليوم + هجري | `greeting.weekdayName` + `hijriDate` | local midnight |
| نقاط | `greeting.points` | any points-earning action |
| متبقي على الصلاة + الاسم | `prayers.nextPrayer.*` | prayer time passes / location / tz |
| عدّاد HH:MM:SS | client timer from `nextPrayer.iso` | zero → refetch dashboard |
| صف الفجر…العشاء + ✓ | `prayers.schedule[]` | mark prayer |
| آية / حديث اليوم | `verseOfTheDay` / `hadithOfTheDay` | new local day |
| رحلتك اليوم (4 tiles) | `dailyJourney.prayer|quran|sadaqah|adhkar` | any daily progress mutation |
| نوافل (optional 5th) | `dailyJourney.nawafel` | nawafel mark |
| ختمة شريط + سورة | `khatmah.*` | khatmah progress |
| تحدي اليوم | `dailyChallenge.*` | complete / claim |

### 2.2 رحلتي — `GET /journey/dashboard`

Matches the Journey screenshot (مستوى / سلسلة / ملخص أسبوع / كالندر):

| UI card | Path under `data` | Stale if you skip refresh after… |
|---------|-------------------|----------------------------------|
| المستوى الحالي + رقم + لقب (مثلاً عبد شاكر) | `levelCard.level`, `rankTitleAr`, `levelProgressPercent` | points / completed day actions |
| 5 ميداليات (ذهبي / فضي) | `levelCard.medals[]` (`earned` / `type`) | streak / first steps badges |
| سلسلة الحسنات + يوم متواصل | `streakCard.days`, `labelAr`, `unitAr` | completing a full day |
| صف الصحاح (مثلاً 9/10) | `streakCard.displayDays` / `recentDays` | same |
| ملخص الأسبوع % (صلاة/قرآن/صدقة/أذكار) | `weeklySummaryCard.categories[]` | any daily mutation in last N days |
| كالندر الشهر + ✓ / اليوم | `monthlyCalendarCard.cells[]` | today’s progress; month swipe uses query |

Optional nested (same response): `todayTiles`, `badges`, `points`, `streakDays`, `dailyChallenge`.

Query (optional):

```http
GET /journey/dashboard?weekDays=7&month=9&year=2026
```

- `weekDays` → weekly bars window (default 7)  
- `month` / `year` → heatmap only (default = user-local current month)

---

## 3. Refresh strategy (mandatory pattern)

### 3.1 Optimistic → confirm → silent sync

```
User taps (mark prayer / pages / adhkar / …)
  1. Update local UI immediately (optimistic)
  2. Send PATCH/POST/PUT
  3. On 2xx:
       - Prefer using mutation response body if it already returns updated today/progress
       - Then silent GET of affected screen(s) (no full-screen shimmer)
  4. On error:
       - Revert optimistic state
       - Show toast / snackbar
```

### 3.2 Silent vs hard reload

| Situation | UX |
|-----------|-----|
| After mutation, pull-to-refresh, tab re-select, resume | **Silent** — keep widgets, swap numbers |
| First open with empty cache | Shimmer / skeleton OK |
| Resume every few seconds | **Debounce 5–10s** — one in-flight request max per endpoint |

Do **not** flash the whole Home/Journey into loading on every `resumed`.

### 3.3 Debounce / coalesce

Coalesce these into **one** in-flight `GET /dashboard` (and separately one `GET /journey/dashboard` if Journey is mounted):

- pull-to-refresh  
- lifecycle `resumed`  
- countdown hit zero  
- mutation success cascade  

Suggested cooldown: **5–10 seconds** per endpoint key.

---

## 4. Mutation → what to refetch (matrix)

After **HTTP success**, invalidate / refetch as below.  
`D` = `GET /dashboard` · `J` = `GET /journey/dashboard` · `N` = `GET /nawafel/today` (if that screen/cache exists)

| User action | Typical API | Refetch |
|-------------|-------------|---------|
| Mark / unmark prayer | `PATCH /prayers/{id}/mark` or `PATCH /journey/prayer` | **D + J** |
| Set / increment Quran pages | `PATCH /journey/quran-pages` or `…/increment` | **D + J** |
| Adhkar progress | `PUT /adhkar/progress` or `PATCH /journey/adhkar` | **D + J** |
| Sadaqah | `PATCH /journey/sadaqah` | **D + J** |
| Nawafel toggle | `PATCH /nawafel/{key}/mark` | **N + D** (+ **J** if Journey open) |
| Khatmah pages / ward | `PATCH`/`POST` khatmah progress APIs | **D** (+ khatmah screen cache) |
| Claim / complete daily challenge | challenge claim endpoint used by app | **D + J** |
| Profile name / timezone / location | `PATCH /profile` | **D** (prayers + greeting); if tz changed also **J** + nawafel/khatmah day keys |
| Notification prefs only | prefs PATCH | **None** for Home/Journey numbers (update Settings UI from response) |

**Rule of thumb:** anything that writes `DailyProgress` / points / streak → refresh **both** Home and Journey caches (Journey can wait until its tab is visible if you want to save a call — then refresh on tab open).

---

## 5. Non-mutation triggers (time & lifecycle)

| Trigger | What to do |
|---------|------------|
| Open Home tab | `GET /dashboard` if cache empty OR older than soft TTL (e.g. 60s) OR dayKey changed |
| Open رحلتي tab | `GET /journey/dashboard` same rule |
| Pull-to-refresh on either screen | Force GET for that screen |
| `AppLifecycleState.resumed` | Debounced silent GET for **visible** tab(s) only |
| Prayer countdown → `00:00:00` | Silent `GET /dashboard` (next prayer + schedule dots) |
| Local calendar day changes in profile `timezone` | Clear day-scoped caches → `D` + `J` + `N` + khatmah today |
| FCM received while foreground (optional) | If `eventType` is informational only, no need; if you add `progress_updated` later → silent refetch |
| App killed → cold start | Normal first load (not Socket reconnect) |

### 5.1 Day key (worldwide)

Backend keys “today” by **IANA** `User.timezone` (`PATCH /profile` with e.g. `"Asia/Riyadh"`).

Flutter must:

1. Keep device scheduling in the **same** IANA zone as profile.  
2. When `yyyy-MM-dd` in that zone flips → treat as new day (section 5 table).  
3. Never assume server UTC midnight.

---

## 6. What does NOT need live refresh

| Feature | Why |
|---------|-----|
| Static Quran text / tafsir catalog | Content files / GET once + disk cache |
| Azkar library lists | Mostly static; progress is separate |
| Azan MP3 catalogs | Rarely change; cache with version if you have one |
| Settings toggles after PATCH | Response body is enough |
| Socket “presence” / typing | N/A for Noor |

---

## 7. Explicit DO NOT

- Do **not** open Socket.io / WebSocket / SSE for dashboard or journey.  
- Do **not** poll `GET /dashboard` every 1–5 seconds.  
- Do **not** hard-code level titles, weekly %, or calendar checks.  
- Do **not** refresh Journey with 4 legacy GETs when `/journey/dashboard` exists.  
- Do **not** block UI on silent refresh failure if optimistic data is already shown (retry quietly).

---

## 8. Recommended Flutter architecture (lightweight)

```text
ProgressRepository / HomeRepository / JourneyRepository
  - cache: DashboardDto?, JourneyDashboardDto?
  - dayKey: String?  // user-local yyyy-MM-dd
  - lastFetchAt: DateTime?
  - inFlight: Future<…>?

void onMutationSuccess(MutationKind kind) {
  markOptimistic(kind);
  unawaited(refreshSilent(affected: {home, journey}));
}

void onResumed() {
  debounce(8.seconds, () => refreshSilent(visibleOnly: true));
}

void onLocalMidnight(String newDayKey) {
  clearDayCaches();
  refreshSilent(affected: allDayScoped);
}
```

Riverpod / Bloc / GetX — same rules; the contract is about **when**, not which state library.

---

## 9. Acceptance checklist (Flutter)

- [ ] Home is driven only by `GET /dashboard` (Part H map)  
- [ ] Journey 4 cards driven by `GET /journey/dashboard`  
- [ ] Mark prayer → Home prayer dots + Journey weekly % update without leaving the app / without Socket  
- [ ] Quran pages → Home tile + Journey bars update  
- [ ] Optimistic UI; failure reverts  
- [ ] Resume uses silent refresh + 5–10s debounce  
- [ ] Countdown zero → dashboard refetch  
- [ ] Timezone day rollover clears “today” caches  
- [ ] No Socket.io dependency for these screens  
- [ ] Pull-to-refresh works on Home and Journey  

---

## 10. One-sentence handoff for the Flutter lead

> **No Socket.io — after every progress mutation and on resume/midnight/countdown-zero, silently refetch `GET /dashboard` and `GET /journey/dashboard`; optimistic UI makes it feel realtime.**
