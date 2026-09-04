# Azan (أذان) — full feature specification

Product feature doc for adding **prayer-time Azan** to Noor. Use this as the source of truth for Flutter + backend work.

Related today:

- Home prayer card + countdown: [`lib/features/home/`](../lib/features/home/)
- Client schedule resolve: [`lib/features/home/domain/prayer_schedule.dart`](../lib/features/home/domain/prayer_schedule.dart)
- Location / Qibla: [`lib/features/qibla/`](../lib/features/qibla/)
- API contract: [`FLUTTER_INTEGRATION_GUIDE.md`](./FLUTTER_INTEGRATION_GUIDE.md)
- Backend gaps: [`BACKEND_REQUIREMENTS.md`](./BACKEND_REQUIREMENTS.md)

---

## 1. Goal

When a prayer time arrives (or shortly before), the device plays the **Azan** (or a gentle alert), shows a clear prayer notification, and keeps working **offline / with screen off** after the user has granted permissions and set a location.

---

## 2. User-facing scope

### 2.1 Must have (v1)

| Feature | Description |
| ------- | ----------- |
| Prayer times for today | Fajr, Dhuhr, Asr, Maghrib, Isha (optional Sunrise for display only — no Azan) |
| Location-based times | Compute from GPS (or saved city) using a calculation method |
| Next-prayer countdown | Already on Home; keep in sync with the same schedule used for Azan |
| Per-prayer Azan toggle | Enable/disable Azan independently for each of the 5 prayers |
| Pre-Adhan reminder | Optional alert N minutes before (e.g. 10 / 15 / 30) |
| Sound | Play a local Azan audio asset (or silent vibration-only mode) |
| Notification | System notification at prayer time with prayer name + time |
| Settings screen | Azan on/off, volume / mute, calculation method, madhab, reminder offset |
| Persistence | Settings + last known schedule survive app kill (local storage) |
| Offline | Once location + method are known, schedule next day locally without network |

### 2.2 Should have (v1.1)

| Feature | Description |
| ------- | ----------- |
| Multiple Azan voices | Pick from bundled reciters (e.g. Makkah, Madinah) |
| Full-screen prayer alert | When unlocked / foreground: branded overlay with “Pray now” + dismiss |
| Auto-reschedule | On midnight, timezone change, or location change → recompute + re-schedule |
| Quiet hours | Optional mute window (e.g. late night — usually not needed for 5 prayers) |
| Guest support | Azan works for guests (local-only; no account required) |

### 2.3 Later (v2+)

| Feature | Description |
| ------- | ----------- |
| Server push backup | FCM “prayer time” push if local alarm was killed (OEM battery) |
| Mosque / Iqama times | Optional Iqama offset after Azan |
| Widget | Home-screen next prayer + countdown |
| Wear / watch | Companion glance |
| Live Activity / Dynamic Island (iOS) | Countdown to next prayer |

---

## 3. Product rules

1. **Sunrise is never Azan** — display only if shown in schedule.
2. **Default:** Azan ON for all five prayers; user can turn any off.
3. **Permission gate:** Without notification (and on Android: exact alarm / battery) permission, show a clear CTA — do not silently fail.
4. **One schedule source of truth:** Same times drive Home card, countdown, and Azan alarms.
5. **Respect DND / volume:** Prefer notification channel that can play Azan; document that system DND may mute.
6. **RTL-safe countdown:** Keep timer `TextDirection.ltr` (already fixed on Home).
7. **No circular loaders** for loading states — use shimmer / dots (app convention).

---

## 4. Calculation & location

### 4.1 Inputs

- Latitude, longitude (from Geolocator — already used in Qibla)
- Timezone (device)
- Calculation method (user setting)
- Asr madhab: Shafi / Hanafi (user setting)

### 4.2 Recommended methods (settings list)

| Key | Label (EN) | Label (AR) |
| --- | ---------- | ---------- |
| `MWL` | Muslim World League | رابطة العالم الإسلامي |
| `EGYPT` | Egyptian General Authority | الهيئة المصرية |
| `MAKKAH` | Umm Al-Qura (Makkah) | أم القرى |
| `KARACHI` | University of Islamic Sciences, Karachi | كراتشي |
| `ISNA` | ISNA | جمعية شمال أمريكا |
| `TEHRAN` | Institute of Geophysics, Tehran | طهران |

**Default for Egypt / MENA-first product:** `EGYPT` (or `MWL` if product prefers).

### 4.3 Library options (Flutter)

Pick one in implementation (document choice in PR):

- `adhan_dart` / `adhan` — pure prayer times from coords
- Or backend `GET /prayers/today?lat=&lng=&method=&madhab=` and cache locally

**Recommendation:** compute **on device** for offline Azan reliability; optionally sync with backend dashboard `prayers.schedule` when online.

### 4.4 Aligning with `GET /dashboard`

Dashboard currently returns `prayers.nextPrayer` + `prayers.schedule`. After Azan ships:

- Prefer **local Adhan engine** for alarms.
- When dashboard 200: can refresh UI times from API **or** overwrite with local calc for consistency.
- When dashboard 500 / offline: local calc only (already partially stubbed via `HomeLocalDataSource` + `PrayerSchedule`).

---

## 5. Scheduling & playback (device)

### 5.1 Alarm strategy

| Platform | Approach |
| -------- | -------- |
| Android | Exact alarms (`SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`) + foreground service or full-screen intent for Azan; high-importance notification channel |
| iOS | Local notifications with sound; background limits — may need to wake with notification sound asset |

Suggested packages (evaluate at implement time):

- `flutter_local_notifications`
- `android_alarm_manager_plus` or `awesome_notifications` (if exact + background needed)
- `audioplayers` / `just_audio` for in-app Azan when app is foreground

### 5.2 Schedule window

On each successful location + settings load:

1. Compute today’s 5 prayer `DateTime`s.
2. Cancel previous pending Azan notifications/alarms.
3. Schedule remaining prayers for today (and optionally tomorrow’s Fajr).
4. At midnight (or after Isha fires): compute next day and schedule again.

### 5.3 What fires at prayer time

1. Local notification: title e.g. `حان موعد صلاة الفجر` / `It's time for Fajr`
2. Play Azan audio (if sound enabled and prayer toggle ON)
3. Optional: open full-screen prayer alert if app was foreground
4. Update Home next-prayer + countdown (reload schedule)

### 5.4 Audio assets

Place under e.g. `assets/audio/azan/`:

- `azan_makkah.mp3`
- `azan_madinah.mp3` (optional)

Register in `pubspec.yaml`. Keep file size reasonable; allow “vibration only” without asset.

---

## 6. Settings model (local)

Persist via existing `LocalStorage` / SharedPreferences (same pattern as offline cache).

```json
{
  "azanEnabled": true,
  "soundEnabled": true,
  "vibrationEnabled": true,
  "voiceId": "makkah",
  "calculationMethod": "EGYPT",
  "madhab": "SHAFI",
  "preReminderMinutes": 15,
  "preReminderEnabled": true,
  "prayers": {
    "fajr": true,
    "dhuhr": true,
    "asr": true,
    "maghrib": true,
    "isha": true
  },
  "lastLat": 30.0444,
  "lastLng": 31.2357,
  "lastLocationLabel": "Cairo"
}
```

Storage keys: add to [`storage_keys.dart`](../lib/core/constants/storage_keys.dart) under an `azan_*` prefix.

---

## 7. UI / UX screens

### 7.1 Entry points

- Home prayer card → tap → **Prayer times / Azan settings** (or dedicated “مواقيت الصلاة”)
- Account / Settings → **Azan & prayer times**
- Bell icon later: in-app notification center (separate from Azan; see guide `/notifications`)

### 7.2 Prayer times screen

- List of today’s times with next highlighted (reuse Home indicator language: completed / next ring / upcoming)
- Countdown (LTR)
- Button: “إعدادات الأذان”
- Location row: city name + “تحديث الموقع”

### 7.3 Azan settings screen

- Master switch: تفعيل الأذان
- Sound / vibration
- Voice picker
- Calculation method + madhab
- Pre-reminder toggle + minutes
- Per-prayer switches (5)

### 7.4 Permissions UX

Ordered prompts:

1. Location (while using / always if required for background refresh)
2. Notifications
3. Android: exact alarms + ignore battery optimizations (explain why)

Use shimmer for loading location/times — no `CircularProgressIndicator`.

---

## 8. Architecture (Flutter)

Suggested feature module:

```
lib/features/azan/
  domain/
    entities/       # PrayerDay, AzanSettings, CalculationMethod
    repositories/
    usecases/       # GetTodayPrayers, ScheduleAzanAlarms, PlayAzan
  data/
    datasources/    # AzanLocalSettings, PrayerTimesCalculator, AzanScheduler
    repositories/
  presentation/
    cubit/
    pages/          # prayer_times_page, azan_settings_page
    widgets/
```

### 8.1 Integration points

| Existing | Change |
| -------- | ------ |
| `HomeRepository` / `PrayerSchedule` | Prefer shared prayer day from Azan domain when available |
| `ConnectivityCubit` | Offline: keep scheduled alarms; don’t block Azan on network |
| `Qibla` / Geolocator | Reuse permission + last position for prayer calc |
| DI (`service_locator`) | Register calculator + scheduler + cubits |
| `AppRouter` | Routes: `/prayer-times`, `/azan-settings` with existing slide transitions |

### 8.2 Background bootstrap

On app start (`main` / after `setupLocator`):

- If Azan enabled → ensure today’s remaining alarms are scheduled (idempotent).

---

## 9. Backend (optional but useful)

Not required for v1 offline Azan. Nice-to-have:

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/prayers/today?lat&lng&method&madhab` | Server-computed times (cross-check / no client lib) |
| `GET` / `PATCH` | `/profile/azan-preferences` | Sync settings across devices for logged-in users |
| `POST` | `/devices/fcm-token` | Already needed for general push; later prayer backup |

Keep dashboard `prayers` section as the Home payload; do not invent a second conflicting schedule for the UI without documenting which wins (**client Adhan wins for alarms**).

---

## 10. Permissions & store compliance

### Android (`AndroidManifest.xml`)

- `POST_NOTIFICATIONS` (API 33+)
- `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`
- `RECEIVE_BOOT_COMPLETED` (reschedule after reboot)
- `FOREGROUND_SERVICE` / media if playing Azan in service
- `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`
- Document battery optimization exception in Play listing / in-app FAQ

### iOS (`Info.plist`)

- Location usage strings
- Notification permission
- Background modes only if justified (audio / fetch) — prefer notification sound for Azan on iOS v1

---

## 11. Localization keys (add to ARB)

Examples:

| Key | EN | AR |
| --- | -- | -- |
| `azanTitle` | Azan | الأذان |
| `prayerTimesTitle` | Prayer times | مواقيت الصلاة |
| `azanSettingsTitle` | Azan settings | إعدادات الأذان |
| `azanEnable` | Enable Azan | تفعيل الأذان |
| `azanPreReminder` | Reminder before prayer | تذكير قبل الصلاة |
| `azanPermissionNeeded` | Allow notifications to hear the Azan | اسمح بالإشعارات لسماع الأذان |
| `azanTimeFor` | It's time for {prayer} | حان موعد صلاة {prayer} |
| `calculationMethod` | Calculation method | طريقة الحساب |
| `madhab` | Asr madhab | مذهب العصر |

---

## 12. Analytics events (optional)

- `azan_permission_granted` / `denied`
- `azan_scheduled` (count of alarms)
- `azan_played` (prayer name)
- `azan_settings_changed`
- `prayer_location_updated`

---

## 13. Testing checklist

- [ ] Times match a trusted reference (e.g. Egypt Authority) within ~1–2 minutes for known coords
- [ ] Toggle Fajr off → no Fajr notification; others still fire
- [ ] Kill app → Azan still notifies (Android exact alarm path)
- [ ] Reboot → alarms restored via `BOOT_COMPLETED`
- [ ] Offline after first setup → next prayer still scheduled
- [ ] RTL: countdown not flipped; prayer names correct
- [ ] Guest user can use Azan without login
- [ ] Changing method/madhab cancels and reschedules
- [ ] No `CircularProgressIndicator` in new screens

---

## 14. Implementation phases

| Phase | Deliverable |
| ----- | ----------- |
| **P0** | Local prayer calc + Prayer times screen + wire Home to same schedule |
| **P1** | Settings + local notifications at prayer time (sound asset) |
| **P2** | Exact alarms / boot reschedule / pre-reminder |
| **P3** | Full-screen alert + multi-voice + profile sync API |
| **P4** | FCM backup + widgets |

---

## 15. Out of scope (this doc)

- Fixing backend `GET /dashboard` 500 (separate — see [`BACKEND_REQUIREMENTS.md`](./BACKEND_REQUIREMENTS.md))
- In-app notification inbox UI (`/notifications` CRUD)
- Live mosque streaming Azan
- Qibla compass (already a separate feature)

---

## 16. Open product decisions (resolve before P1)

Document answers in the implementing PR:

1. Default calculation method: `EGYPT` vs `MWL`?
2. Default pre-reminder: off vs 15 minutes?
3. iOS v1: notification sound only vs attempt background audio?
4. Should logged-in users sync Azan prefs to backend in v1 or local-only?
