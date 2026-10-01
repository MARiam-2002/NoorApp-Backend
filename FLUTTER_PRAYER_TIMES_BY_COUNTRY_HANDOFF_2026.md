# Flutter Prayer Times by Country (`AUTO` method + Arab & Gulf countries) Handoff — 2026

**Audience:** Flutter team  
**From:** Noor Backend  
**Production base URL:** `https://noor-app-backend-one.vercel.app/api/v1` (Railway mirror: `https://noorapp-backend-production.up.railway.app/api/v1`)  
**Updated:** 2026-10-01  
**Language:** English only  

**Backend status:** Live on production (Vercel + Railway) and verified. Prayer times now follow each country's official authority and match the ministries' published 2026 timetables within 1 minute (Asr and Moroccan sunrise/Maghrib within 2 minutes, because of city elevation). All API changes are additive: no field, id, type or route was renamed or removed.

**Related:** [`FLUTTER_INTEGRATION_GUIDE.md`](FLUTTER_INTEGRATION_GUIDE.md) (top two sections, 2026-10-01 and 2026-09-29) · [`FLUTTER_NOTIFICATIONS_FINAL_2026.md`](FLUTTER_NOTIFICATIONS_FINAL_2026.md) §6 · [`ADHAN_FEATURE_FINAL.md`](ADHAN_FEATURE_FINAL.md) §6

---

## 0. What Flutter has to do

| # | Change | Needed when | Priority |
|---|--------|-------------|----------|
| 1 | Stop sending `method=EGYPT` (or any default method) to `/prayers/today` and `/prayers/schedule` | The app adds a method to every prayer request | **Required** |
| 2 | Default the saved method to `"AUTO"`, not `"EGYPT"` | The app sends a default `calculationMethod` on first save / sign-up | **Required** |
| 3 | Update the offline `adhan_dart` fallback (§4) | The app calculates times on the device when offline | **Required** |
| 4 | Morocco time zone guard (§5) | The app formats `iso` with the device/`timezone` package, or schedules Duha/Qiyam by local clock time | **Required** for Moroccan users |
| 5 | Picker subtitle «تلقائي — …» (§3.2) | Always | Recommended |
| 6 | Method picker shows the new items | Only if the picker list is hard-coded. If it is built from `GET /azan/calculation-methods`, nothing to do | Only if hard-coded |

If the app already shows the API's `time` / `displayAr`, schedules from `iso`, builds the picker from the catalog, and sends no default method, items 1, 2, 5 and 6 need no code. Items 3 and 4 still apply if there is an offline fallback or local clock-time scheduling.

---

## 1. What changed on the server

**Before:** every account defaulted to the Egyptian method. Outside Egypt the times were wrong, for example:

| City | Old error (before the fix) |
|------|----------------------------|
| Tabuk, Saudi Arabia | Isha 19:37 instead of 19:51 (14 min early) |
| Morocco (all cities) | Every prayer about **1 hour late** |
| Algiers | Fajr 8–13 min early |
| Amman | Fajr 7–9 min early, Maghrib 6–7 min early |
| Muscat | Fajr, Dhuhr, Asr, Maghrib 4–7 min early |

**Now:**

- New default method **`AUTO`**: the server uses the official method of the country at the user's coordinates, and switches automatically when the user travels. An explicit user pick (e.g. `EGYPT`, `MAKKAH`) always wins.
- Six new methods: `MOROCCO`, `ALGERIA`, `TUNISIA`, `JORDAN`, `OMAN`, `BAHRAIN`. `DUBAI` (UAE) re-tuned to the UAE Awqaf timetable.
- Morocco returned to GMT (UTC+0) on 2026-09-20. The server corrects for this, so all text it returns is right (see §5 for the device side).
- Existing accounts that were on the old Egyptian default were moved to `AUTO` on the server.
- The screen, the dashboard and the Azan push now use the same method **and madhab**.
- `PATCH /profile/azan-preferences` now changes only the fields you send. Before, sending one toggle reset the method, madhab and other settings to defaults.

### 1.1 Country → method used by `AUTO`

| Country | Method id | Verified against |
|---------|-----------|------------------|
| Saudi Arabia | `MAKKAH` | Umm Al-Qura |
| Egypt | `EGYPT` | Egyptian General Authority of Survey (unchanged) |
| UAE | `DUBAI` | UAE Awqaf (full year 2026) + Dubai IACAD |
| Oman | `OMAN` | Ministry of Awqaf, Muscat (Jan, Apr, Jul, Oct 2026) |
| Jordan, Palestine | `JORDAN` | Jordan Ministry of Awqaf (Amman) |
| Morocco (incl. Western Sahara) | `MOROCCO` | Ministry of Habous (10 cities) |
| Algeria | `ALGERIA` | Ministry of Religious Affairs (Jun, Sep–Oct, Dec 2026) |
| Kuwait / Qatar | `KUWAIT` / `QATAR` | Standard national method |
| Tunisia / Bahrain | `TUNISIA` / `BAHRAIN` | Standard national method (18° / 18°) |
| Iraq, Syria, Lebanon, Yemen, Libya, Sudan, Mauritania, Somalia, Djibouti, Comoros | `EGYPT` | Unchanged |
| Turkey | `TURKEY` | Diyanet |
| Pakistan, India, Bangladesh, Afghanistan | `KARACHI` | |
| Malaysia, Singapore, Brunei | `SINGAPORE` | |
| Indonesia | `KEMENAG` | |
| United Kingdom | `MOONSIGHTING` | |
| USA, Canada | `ISNA` | |
| Everywhere else | `MWL` | |

---

## 2. Endpoints

| Method | Path | Auth | What changed |
|--------|------|------|--------------|
| `GET` | `/azan/calculation-methods` | Public | First item is now `AUTO` (`isDefault: true`); `defaultId` is `"AUTO"`; 6 new items appended (`sortOrder` 15–20) |
| `GET` / `PATCH` | `/profile/azan-preferences` | Bearer | New read-only fields `effectiveCalculationMethod`, `calculationMethodSource`. Accepts `calculationMethod: "AUTO"` and the new ids. PATCH is now partial |
| `GET` | `/prayers/today` | Optional Bearer | New field `calculationMethodSource`; `calculationMethod` is the resolved method |
| `GET` | `/prayers/schedule?lat=&lng=&date=YYYY-MM-DD` | Public | Same as above |
| `GET` | `/dashboard` → `prayers` | Bearer | Same as above |
| `PATCH` | `/profile` with `prayerCalculationMethod` | Bearer | Now also updates the Azan preferences, so the screen and the push stay identical |

---

## 3. Response contracts

All responses use the standard envelope `{ success, message, data, meta, timestamp, requestId }`.

### 3.1 `GET /azan/calculation-methods` (new items)

```json
{
  "defaultId": "AUTO",
  "methods": [
    { "id": "AUTO", "nameAr": "تلقائي حسب الدولة", "nameEn": "Automatic (by country)",
      "regionHintAr": "كل الدول", "regionHintEn": "All countries", "isDefault": true, "sortOrder": 0 },
    "... existing items (EGYPT, MWL, MAKKAH, ...) unchanged, EGYPT no longer isDefault ...",
    { "id": "MOROCCO", "nameAr": "وزارة الأوقاف والشؤون الإسلامية (المغرب)", "nameEn": "Ministry of Habous (Morocco)", "sortOrder": 15 },
    { "id": "ALGERIA", "nameAr": "وزارة الشؤون الدينية والأوقاف (الجزائر)", "nameEn": "Ministry of Religious Affairs (Algeria)", "sortOrder": 16 },
    { "id": "TUNISIA", "nameAr": "تونس", "nameEn": "Tunisia", "sortOrder": 17 },
    { "id": "JORDAN", "nameAr": "وزارة الأوقاف (الأردن)", "nameEn": "Ministry of Awqaf (Jordan)", "sortOrder": 18 },
    { "id": "OMAN", "nameAr": "وزارة الأوقاف والشؤون الدينية (عُمان)", "nameEn": "Ministry of Awqaf (Oman)", "sortOrder": 19 },
    { "id": "BAHRAIN", "nameAr": "البحرين", "nameEn": "Bahrain", "sortOrder": 20 }
  ]
}
```

Every item also has `aliases`, `descriptionAr`, `descriptionEn`, `regionHintAr`, `regionHintEn` as before.

### 3.2 `GET /profile/azan-preferences` (new fields)

```json
{ "calculationMethod": "AUTO", "effectiveCalculationMethod": "MAKKAH", "calculationMethodSource": "auto",
  "madhab": "SHAFI", "lastLat": 28.3835, "lastLng": 36.5662, "lastLocationLabel": "Tabuk", "...": "unchanged fields" }
```

- `calculationMethod`: what the user chose (`"AUTO"` unless they picked a method in settings). Preselect this in the picker.
- `effectiveCalculationMethod`: the method actually used right now.
- `calculationMethodSource`: `"auto"` or `"user"`.

Picker subtitle when the source is `auto`: «تلقائي — {nameAr of effectiveCalculationMethod}», e.g. «تلقائي — أم القرى (مكة المكرمة)».

```dart
final method = prefs['calculationMethod'] as String? ?? 'AUTO';
final effective = prefs['effectiveCalculationMethod'] as String? ?? method;
final isAuto = prefs['calculationMethodSource'] == 'auto';
final subtitle = isAuto ? 'تلقائي — ${catalogNameAr(effective)}' : catalogNameAr(method);
```

### 3.3 Prayer payloads (`/prayers/today`, `/prayers/schedule`, `/dashboard` → `prayers`)

`GET /prayers/schedule?lat=33.5731&lng=-7.5898&date=2026-10-01` (Casablanca):

```json
{ "timezone": "Africa/Casablanca", "calculationMethod": "MOROCCO", "calculationMethodSource": "auto", "madhab": "SHAFI",
  "schedule": [ { "key": "FAJR", "time": "04:57", "iso": "2026-10-01T04:57:00.000Z" },
                { "key": "DHUHR", "time": "12:25" }, { "key": "ASR", "time": "15:43" },
                { "key": "MAGHRIB", "time": "18:20" }, { "key": "ISHA", "time": "19:33" } ],
  "sunrise": { "key": "SUNRISE", "time": "06:21" } }
```

For Egypt, `calculationMethod` stays `"EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY"` as before.

---

## 4. Offline fallback (`adhan_dart`): must match the server

Online, always use the server's `iso`. Offline, the device calculation must use the same parameters as the server, or local alarms will disagree with the push.

1. Use **`effectiveCalculationMethod`** from the last cached `/profile/azan-preferences` (never `"AUTO"` directly). For a guest or no cache, resolve it from the last cached prayer payload's `calculationMethod`.
2. **Do not use `adhan_dart`'s built-in `morocco`, `jordan`, `tunisia`, `algerian`, `dubai` presets.** Their angles and offsets differ from the ministries' tables. Use the explicit parameters below.

| Method id | Fajr angle | Isha angle | Minute offsets (`methodAdjustments`) |
|-----------|-----------|-----------|--------------------------------------|
| `DUBAI` | 18.2 | 18.2 | sunrise −3, dhuhr +2, maghrib +3, isha −1 |
| `MOROCCO` | 19 | 17 | sunrise −4, dhuhr +5, asr +1, maghrib +5 |
| `ALGERIA` | 18 | 17 | maghrib +3 |
| `JORDAN` | 18 | 18 | sunrise −6, asr +1, maghrib +6 |
| `OMAN` | 18 | 18 | dhuhr +5, asr +5, maghrib +5 |
| `TUNISIA` | 18 | 18 | none |
| `BAHRAIN` | 18 | 18 | none |

All other ids keep the mapping in `ADHAN_FEATURE_FINAL.md` §6 (`EGYPT` → egyptian, `MAKKAH` → ummAlQura, `KUWAIT`, `QATAR`, `TURKEY`, …).

```dart
CalculationParameters custom(double fajr, double isha, [Map<Prayer, int> adj = const {}]) =>
    CalculationParameters(
      method: CalculationMethod.other,
      fajrAngle: fajr,
      ishaAngle: isha,
      methodAdjustments: {...adj},
    );

CalculationParameters? noorCountryParams(String id) {
  switch (id) {
    case 'DUBAI':
      return custom(18.2, 18.2, {Prayer.sunrise: -3, Prayer.dhuhr: 2, Prayer.maghrib: 3, Prayer.isha: -1});
    case 'MOROCCO':
      return custom(19, 17, {Prayer.sunrise: -4, Prayer.dhuhr: 5, Prayer.asr: 1, Prayer.maghrib: 5});
    case 'ALGERIA':
      return custom(18, 17, {Prayer.maghrib: 3});
    case 'JORDAN':
      return custom(18, 18, {Prayer.sunrise: -6, Prayer.asr: 1, Prayer.maghrib: 6});
    case 'OMAN':
      return custom(18, 18, {Prayer.dhuhr: 5, Prayer.asr: 5, Prayer.maghrib: 5});
    case 'TUNISIA':
    case 'BAHRAIN':
      return custom(18, 18);
  }
  return null; // fall back to the existing mapping (ADHAN_FEATURE_FINAL.md §6)
}
```

Then apply as today: `madhab`, `highLatitudeRule = HighLatitudeRule.recommended(coordinates)`, `polarCircleResolution = PolarCircleResolution.aqrabBalad`, and `ishaInterval = 120` for `MAKKAH` in Ramadan.

---

## 5. Morocco time zone (device side)

Morocco returned to **GMT (UTC+0)** on **2026-09-20** (Decree 2.26.530). Time-zone databases released before that, including possibly the one bundled in the `timezone` package and some phones' OS data, still treat `Africa/Casablanca` / `Africa/El_Aaiun` as UTC+1. With old data every prayer shows **one hour late**.

The server already returns correct `time`, `displayAr`, `displayEn` and push text, and `iso` is an absolute instant (always correct).

- **Display:** show the API's `time` / `displayAr` / `displayEn`. Don't rebuild the display from `iso` + device zone.
- **Prayer alarms:** schedule from `iso` (absolute). That's already correct.
- **Clock-time items (Duha, Qiyam) and the offline fallback:** these use the `timezone` package. Guard Morocco:

```dart
bool _moroccoTzDataIsStale() {
  final probe = tz.TZDateTime.from(DateTime.utc(2026, 10, 1, 12), tz.getLocation('Africa/Casablanca'));
  return probe.timeZoneOffset != Duration.zero;
}

tz.Location prayerLocation(String zone) {
  if ((zone == 'Africa/Casablanca' || zone == 'Africa/El_Aaiun') && _moroccoTzDataIsStale()) {
    return tz.UTC;
  }
  return tz.getLocation(zone);
}
```

The guard turns itself off once the bundled data includes the change.

---

## 6. QA checklist (production values, Shafi'i)

Call `GET /prayers/schedule?lat=&lng=&date=` as a guest (no `method`), or log in with the method on `AUTO` at that location. Expected (the app must show exactly these strings):

| City | Date | `calculationMethod` | Fajr | Sunrise | Dhuhr | Asr | Maghrib | Isha |
|------|------|---------------------|------|---------|-------|-----|---------|------|
| Tabuk (28.3835, 36.5662) | 2026-09-30 | `MAKKAH` | 05:06 | 06:26 | 12:24 | 15:47 | 18:21 | 19:51 |
| Cairo (30.0444, 31.2357) | 2026-10-01 | `EGYPTIAN_GENERAL_AUTHORITY_OF_SURVEY` | 05:22 | 06:48 | 12:46 | 16:08 | 18:41 | 19:58 |
| Casablanca (33.5731, −7.5898) | 2026-10-01 | `MOROCCO` | 04:57 | 06:21 | 12:25 | 15:43 | 18:20 | 19:33 |
| Algiers (36.7538, 3.0588) | 2026-10-01 | `ALGERIA` | 05:17 | 06:43 | 12:37 | 15:57 | 18:34 | 19:52 |
| Amman (31.9539, 35.9106) | 2026-10-01 | `JORDAN` | 05:09 | 06:24 | 12:26 | 15:49 | 18:28 | 19:42 |
| Muscat (23.588, 58.3829) | 2026-10-01 | `OMAN` | 04:43 | 05:58 | 12:01 | 15:25 | 17:59 | 19:09 |
| Dubai (25.2048, 55.2708) | 2026-09-14 | `DUBAI` | 04:47 | 06:01 | 12:17 | 15:42 | 18:27 | 19:41 |

- [ ] Tabuk user on `AUTO`: the Isha notification arrives at **19:51** (it was 19:37).
- [ ] Casablanca: times shown in GMT (Fajr 04:57, not 05:57). The Duha/Qiyam reminder fires at the chosen clock time, not one hour later.
- [ ] Picker preselects «تلقائي حسب الدولة» for a new user; subtitle shows the effective method.
- [ ] Picking `EGYPT` manually in Tabuk shows Isha 19:37 on the screen **and** in the push (an explicit pick wins).
- [ ] Toggling one setting (e.g. sound off) does not reset the method or madhab.
- [ ] Offline (airplane mode) in Casablanca, Amman and Dubai: the fallback times equal the table above (±1 min).
