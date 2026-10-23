# Noor — short Takbir implementation handoff

Date: 23 October 2026. Backend implementation is additive. Flutter must implement the UI, bundle the assets, create the channels, and rebuild local schedules before this becomes audible on phones. Backend verification does not certify physical-device behavior.

## Product behavior and screen design

Keep the existing full-Adhan voice selector. Under **صوت وقت الصلاة / Prayer-time sound**, show three radio rows:

1. **أذان كامل / Full Adhan** (`azan`): use the existing selected full-Adhan voice.
2. **تكبيرات قصيرة / Short takbir** (`takbir`): show the independent short-voice picker below this row when selected. Subtitle: **بداية الأذان فقط، مناسبة للعمل أو الدراسة**. The opening excerpts have different lengths; do not label every file “two takbirs” or promise an identical repetition count.
3. **تنبيه دخول الصلاة / Prayer-time announcement** (`announcement`): retain the existing prayer-specific spoken announcement implementation. It is a different feature from takbir. Never relabel its stored value to mean takbir.

Existing accounts retain their stored mode; default remains full Adhan. Default short voice, only when choosing takbir for the first time: **ناصر القطامي**, `takbir_nasser_al_qatami_v1`, the approved short v2 preview (approximately 13.2 seconds), NOT the older 27-second candidate.

Short picker: list the available catalog voices with name, actual duration, one radio selector and a separate accessible play/stop button. Keep the selected voice first; preserve catalog names for the three Alafasy variants. Only one preview plays at a time. Stop it on navigation, app background, save, or a real alarm. Do not auto-play when opening the screen. Provide a preview control that works locally offline after installation. Show loading/error/retry for catalog refresh, without losing saved choices. Respect RTL, font scaling, dark/light themes and minimum 48dp touch targets.

Below the global choice, add **تخصيص لكل صلاة / Customize each prayer**. Each of Fajr, Dhuhr, Asr, Maghrib, Isha offers **حسب الإعداد العام / Use global setting**, Full Adhan, Short takbir, Announcement. Show the effective choice next to each prayer. Friday Dhuhr uses the Dhuhr override. A separate per-prayer short voice is NOT part of this API; all takbir occurrences use the account's takbirSoundId. Provide **تطبيق الإعداد العام على كل الصلوات / Use global setting for all prayers** by clearing overrides after an explicit user tap.

Keep existing global sound/vibration/prayer enabled toggles. “Silent” continues to mean soundEnabled=false; do not invent a fourth stored sound-mode enum. When sound is disabled, visibly indicate silence and disable the sound selection controls without deleting the stored choices. Do not bypass DND or force maximum device volume.

## API contract

Base: `https://noorapp-backend-production.up.railway.app/api/v1`. Standard responses use `{success,data,message,...}`.

- Public `GET /azan/takbir-sounds`: catalogVersion=1, preferenceValue=`takbir`, defaultId, count=14, minimumChannelSchemaVersion=3, requiresNativeBundling=true, unsupportedDevicePolicy=`SILENT_NOTIFICATION_NEVER_FULL_ADHAN`, sounds[].
- Each sound exposes id, nameAr/nameEn, sourceAzanSoundId, durationSeconds, mediaFile, nativeSound, iosSoundFile, audioUrl/previewUrl (MP3), iosAudioUrl (CAF), mp3Sha256, cafSha256, available, reviewStatus and original-source metadata. Do not assume all full-Adhan voices have a short version. Use only available entries actually bundled by this app version. Content approval came from the product owner; this change does not independently establish new recording licenses.
- `GET /profile/azan-preferences`: existing fields plus `takbirSoundId` and `prayerTimeSoundOverrides`. `prayerTimeSoundMode` accepts `azan | announcement | takbir`.
- Authenticated `PATCH /profile/azan-preferences` changes only supplied top-level fields. Omitted fields remain unchanged. Unknown takbir IDs, invalid modes and unknown prayer keys return validation errors; do not silently switch sounds. Do not send the full defaults object on every save.

Example: choose short takbir globally:

```json
{"prayerTimeSoundMode":"takbir","takbirSoundId":"takbir_nasser_al_qatami_v1"}
```

Example: full Fajr, short Dhuhr/Asr, other prayers inherit global:

```json
{"prayerTimeSoundOverrides":{"fajr":"azan","dhuhr":"takbir","asr":"takbir"}}
```

The override object is a **replacement map**, not a nested partial merge. Preserve other existing prayer overrides when editing one row. To restore inheritance for one prayer, omit that key from the complete replacement map. Send `{ "prayerTimeSoundOverrides": {} }` to clear all overrides. All keys are lowercase. Global mode changes do not implicitly delete overrides.

Effective mode: `overrides[prayerKey] ?? prayerTimeSoundMode`. Resolve this before selecting the native asset. Keep full `azanSoundId`/legacy `voiceId`, `notificationSoundId` (pre-reminder tone) and `takbirSoundId` independent. Selecting takbir must not overwrite the full-Adhan voice or the pre-reminder sound.

## Assets: no separate ZIP needed

All 14 approved MP3s are in backend `assets/takbir/`; ready-made iOS CAF versions are in `assets/takbir-ios/`. `assets/takbir/manifest.json` records hashes and measured durations. Files may also be fetched individually through the catalog URLs under `/azan/media/<filename>`; MP3 and CAF endpoints support byte ranges. Verify SHA-256 before using downloaded build inputs. Bundle them during development/build, not on the first notification.

IDs (all end in `_v1`; use the exact names):

```text
takbir_abul_ainain_shuaisha_v1
takbir_ahmed_al_trabulsi_v1
takbir_ali_mulla_v1
takbir_assem_bukhari_v1
takbir_mishary_alafasy_v1
takbir_mishary_alafasy_2_v1
takbir_mishary_alafasy_3_v1
takbir_mohamed_minshawi_v1
takbir_mohamed_rifaat_v1
takbir_mohammed_kabbara_v1
takbir_naji_qazzaz_v1
takbir_noureddine_hamza_v1
takbir_wadi_al_yamani_v1
takbir_nasser_al_qatami_v1
```

Android: copy each `<id>.mp3` into `android/app/src/main/res/raw/`; use `RawResourceAndroidNotificationSound(id)`. No runtime slicing, full-Adhan player timer, stream dependency or arbitrary truncation. Keep names lowercase. Include the resources in release resource-shrinking rules if necessary and verify them in the final release build.

iOS: add each `<id>.caf` to the Runner target AND Copy Bundle Resources; use the exact filename as the notification sound. These supplied mono PCM CAF clips are below 30 seconds. A Dart asset declaration alone does not put a CAF file in the native notification bundle. Test in an actual signed iOS build if iOS is supported.

## Android channel schema 3 and device capabilities

Fetch `GET /devices/notification-channels` and synchronize schema **3** before scheduling or registering capabilities. This adds 28 channels (14 voices, with/without vibration), resulting in 117 channels and 53 required bundled sound basenames. Existing v2 channel repairs remain valid; do not delete unrelated channels or user channel preferences.

For a short voice ID `id`, exact channel IDs are `azan_<id>` (vibration) and `azan_<id>_novib` (no vibration). Native sound is `id`; audio usage is alarm, importance max. Global silence uses existing `azan_silent` / `azan_silent_novib`, not an audible channel with playSound=false. Android freezes sound at channel creation: use stable versioned IDs and never reuse an old full-Adhan channel for takbir.

On token registration/refresh, startup, login and channel synchronization, submit the existing `POST /devices/fcm-token` body with `capabilities.channelSchemaVersion:3` and `capabilities.bundledSounds` containing ALL actual supported basenames, including the 14 new ones. Merge with previous supported sounds; do not report merely catalog-advertised files or replace the entire list with only takbir IDs. Report schema 3 only AFTER channel creation and asset verification complete. Re-register capability data even when the FCM token string has not changed. iOS also reports schema 3 as support for this audio contract after its bundle check.

The backend gates short audio **per token/device**. A device lacking schema 3 or the selected bundled file receives a silent notification with `audioFallbackReason=TAKBIR_NOT_BUNDLED_ON_DEVICE`. A ready device on the same account still receives short audio. There is deliberately NO full-Adhan fallback. Do not override that silence on the client. The existing account-level localScheduledUntil coverage model is unchanged; it is not proof of per-device delivery.

## FCM and local playback ownership

Takbir at prayer time keeps `data.type=AZAN` and `soundType=AZAN` for routing compatibility, with:

```text
prayerTimeSoundMode=takbir
audioScope=prayer_time_takbir
takbirSoundId=<selected short id>
soundId=<selected short id>
azanSoundId=<selected short id>
sourceAzanSoundId=<original recording id>
azanSoundUrl=<SHORT MP3 URL>
azanSoundMediaFile=<short id>.mp3
nativeSound=<short id>     (or empty when silent)
androidChannelId=azan_<short id>[_novib] (or existing silent channel)
audioOwner=NOTIFICATION_CHANNEL
deliveryMode=OS_NOTIFICATION
source=FCM_BACKUP
```

FCM string flags must be parsed as strings (`'false'` must not become true). `sourceAzanSoundId` is attribution only; NEVER use it to start the original full recording. The server's effective short URLs and IDs override the locally selected full voice for this occurrence.

Background FCM notification is owned by the OS channel/APNs sound. Do not additionally start an audio service, Dart player or second local notification. Foreground handling may show one local notification using the supplied channel/sound, respecting nativeSound empty/soundEnabled=false, occurrenceKey and expiry. Do not also play it in-app. Ignore an expired event. Keep the existing local/FCM occurrence deduplication and backup coverage logic. Tapping a tray notification navigates to prayer times; it must not automatically start full Adhan.

Local scheduled prayer notifications must apply the same effective per-prayer mode and native asset/channel. A network stream preview does not configure a notification sound. Pre-prayer reminders continue using notificationSoundId. Fajr wake-up alarm remains a separate opt-in feature; this change must not alter it.

## Save, synchronization and rescheduling

1. Verify the selected asset and required channels locally. Keep a draft selection until saved; serialise saves and ignore stale responses.
2. PATCH only changed settings, handle validation/auth/network failures, and render the normalized response as saved state. Offline edits must show pending sync; do not pretend server confirmation.
3. Cancel/rebuild the affected future local prayer notifications after a successful preference change. Remove the old full-Adhan occurrences; restarting the app alone is insufficient. Preserve unrelated reminder families and completed history. Rebuild after login, timezone/location/date changes, OS reboot and permissions recovery according to the platform's scheduler.
4. Preference PATCH invalidates existing localScheduledUntil unless explicitly supplied. Do NOT include an old coverage timestamp with an audio change. Report fresh local coverage only after the new notifications are successfully scheduled, using the current scheduleKey and the existing travel coverage contract. Never acknowledge an old scheduleKey.
5. On scheduling failure, show a retry state and keep coverage unset; do not mark pending scheduling as complete. On logout/account switch, clear account-scoped schedules and hydrate the next account. Keep explicit guest choices separate; guests save locally.

## Required acceptance tests before app release

- Existing account saves an unrelated setting: full voice, mode, short voice and overrides do not reset.
- Select each of 14 voices, preview it, confirm its duration, then test actual foreground/background/terminated local and FCM notifications on release Android. Test iOS physical devices when supported.
- Nasser plays the approved short version, stops naturally, and never starts the full recording afterwards. No duplicate player/notification.
- Full Fajr + short Dhuhr/Asr + inherited Maghrib/Isha; Friday Dhuhr override; override removal; clear-all overrides; muted sound; no vibration; disabled prayer; disabled Azan.
- Old app, missing native resource and schema 2 device stay silent for takbir; another schema 3 device on the same account still receives short audio.
- Preferences survive restart/login; account switching does not leak settings or schedules. Preview/scheduled sound works with no network.
- Save while old full-Adhan occurrences are scheduled: those future entries are replaced; schedule coverage is reported only after success. Test midnight, Cairo DST and Saudi timezone without altering prayer-time calculations.
- Android notification permission, exact-alarm permission and battery restrictions: show accurate status and recovery actions. Respect system channel sound overrides, silent mode and DND. Never promise exact audible delivery under all OS/device conditions.

Backend checks include typecheck/build, the 14-file catalog and schema validation, partial persistence with a mocked DB, override inheritance, schedule-key invalidation, per-device silent fallback, APNs/Android sound consistency and the real reminder-generation code with a mocked sender. No live users were sent test pushes. Physical device testing remains Flutter's release requirement.
