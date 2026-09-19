# ✅ Salawat Reminder Feature - Implementation Status

**Last Updated:** 2026-09-20  
**Status:** ✅ **FULLY IMPLEMENTED** (audio files need completion)

---

## 📋 Overview

The **Salawat Reminder** feature is **fully functional** in the Noor backend.

**Phrase:** "صلِّ على محمد ﷺ"

All backend infrastructure, APIs, database schema, and FCM integration are **production-ready**.

---

## ✅ Implemented Components

### 1. API Endpoints

| Endpoint | Method | Auth | Status | Description |
|----------|--------|------|--------|-------------|
| `/salawat/audio` | GET | ❌ Public | ✅ **LIVE** | Audio catalog (picker) |
| `/salawat/media/{file}` | GET | ❌ Public | ✅ **LIVE** | Stream MP3 file |
| `/profile/salawat-preferences` | GET | ✅ Required | ✅ **LIVE** | Get user preferences |
| `/profile/salawat-preferences` | PATCH | ✅ Required | ✅ **LIVE** | Update preferences |
| `/profile/salawat-preferences` | PUT | ✅ Required | ✅ **LIVE** | Update preferences (alias) |

### 2. Database Schema

```prisma
model User {
  // Salawat Reminder Preferences
  salawatReminderEnabled Boolean @default(false)
  salawatIntervalMinutes Int     @default(180)  // 3 hours
  salawatWindowStart     String  @default("08:00")
  salawatWindowEnd       String  @default("22:00")
  salawatAudioClipId     String?
  
  salawatSendLog SalawatSendLog[]
}

model SalawatSendLog {
  id             String   @id @default(uuid())
  userId         String
  occurrenceKey  String
  createdAt      DateTime @default(now())
  
  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, occurrenceKey])
  @@index([userId, createdAt(sort: Desc)])
}
```

✅ **Status:** All migrations applied to production database

### 3. Audio Catalog

**Current clips:**

| ID | Name | Type | Status | Duration |
|----|------|------|--------|----------|
| `salli_ala_muhammad_voice` | صلِّ على محمد (صوت) | Voice | ⚠️ **FILE MISSING** | 2s |
| `peaceful_reminder_tone` | نغمة تذكير هادئة | Tone | ✅ Available | 4s |
| `calm_chime` | رنين هادئ | Tone | ✅ Available | 2s |

**Default:** `salli_ala_muhammad_voice` (falls back to `peaceful_reminder_tone` if unavailable)

### 4. FCM Push Notifications

**Type:** `SALAWAT`

**Payload:**
```json
{
  "type": "SALAWAT",
  "kind": "salawat_reminder",
  "audioUrl": "https://.../salawat/media/salli_ala_muhammad.mp3"
}
```

**Notification:**
```json
{
  "title": "Pray for the Prophet ﷺ",
  "titleAr": "الصلاة على النبي ﷺ",
  "body": "O Allah, send blessings and peace upon our Prophet Muhammad ﷺ",
  "bodyAr": "اللهم صل وسلم على نبينا محمد ﷺ"
}
```

✅ **Status:** Integrated with existing FCM infrastructure

### 5. Cron Job

**Endpoint:** `POST /cron/prayer-reminders`

**Schedule:** Every 15 minutes (Railway/Vercel cron)

**Logic:**
- ✅ User-specific timezone support
- ✅ Configurable interval (30, 60, 120, 180 minutes)
- ✅ Active window (default 08:00-22:00)
- ✅ De-duplication (occurrence-based)
- ✅ Max 48 reminders/day safety cap

✅ **Status:** Production-ready

---

## 📊 API Response Format (Flutter Contract)

### GET /salawat/audio

**Response:**
```json
{
  "success": true,
  "message": "Salawat audio catalog retrieved successfully",
  "data": {
    "defaultId": "salli_ala_muhammad_voice",
    "count": 3,
    "selectableCount": 3,
    "availableCount": 2,
    "fileCount": 2,
    "clips": [
      {
        "id": "salli_ala_muhammad_voice",
        "title": "Salli ala Muhammad (voice)",
        "titleAr": "صلِّ على محمد (صوت)",
        "creator": "ibrahim_baig",
        "creatorAr": "ibrahim_baig",
        "url": "https://.../salawat/media/salli_ala_muhammad.mp3",
        "audioUrl": "https://.../salawat/media/salli_ala_muhammad.mp3",
        "previewUrl": "https://.../salawat/media/salli_ala_muhammad.mp3",
        "listenUrl": "https://freesound.org/people/ibrahim_baig/sounds/788917/",
        "youtubeUrl": null,
        "spotifyUrl": null,
        "source": "https://freesound.org/people/ibrahim_baig/sounds/788917/",
        "license": "CC0-1.0",
        "attribution": "Sale'ala'Muhammad by ibrahim_baig (Freesound), CC0 1.0",
        "durationSeconds": 2,
        "playback": "file",
        "selectable": true,
        "available": false,
        "isDefault": true
      }
    ],
    "sourcePolicy": {
      "note": "Voice recording saying \"Salli ala Muhammad\" plus short notification tones. All CC0 licensed from Freesound.org.",
      "sources": [...]
    }
  },
  "meta": {},
  "timestamp": "2026-09-20T01:00:00.000Z",
  "requestId": "uuid"
}
```

### GET /profile/salawat-preferences

**Response:**
```json
{
  "success": true,
  "message": "Salawat preferences retrieved successfully",
  "data": {
    "enabled": true,
    "intervalMinutes": 180,
    "startTime": "08:00",
    "endTime": "22:00",
    "windowStart": "08:00",
    "windowEnd": "22:00",
    "quietHoursStart": "22:00",
    "quietHoursEnd": "08:00",
    "audioClipId": "salli_ala_muhammad_voice"
  },
  "meta": {},
  "timestamp": "2026-09-20T01:00:00.000Z",
  "requestId": "uuid"
}
```

### PATCH /profile/salawat-preferences

**Request:**
```json
{
  "enabled": true,
  "intervalMinutes": 120,
  "startTime": "09:00",
  "endTime": "21:00",
  "audioClipId": "salli_ala_muhammad_voice"
}
```

**Response:** Same as GET (updated values)

---

## ⚠️ What's Missing: Audio Files

### Required Action:

**Add 3-5 voice recordings of "صلِّ على محمد ﷺ"**

**Current situation:**
- ✅ Infrastructure ready
- ✅ Code ready
- ⚠️ Only 1 voice clip configured (file not downloaded)
- ⚠️ 2 generic notification tones (not voice)

**Requirements:**
- **Phrase:** ONLY "صلِّ على محمد ﷺ"
- **Duration:** 2-5 seconds each
- **Quality:** Clear Arabic voice
- **License:** CC0, Public Domain, or redistribution-allowed
- **Format:** MP3
- **No:** Music, effects, background sounds

---

## 🔍 Audio Source Requirements

### ✅ Acceptable Sources:
- Freesound.org (CC0 license)
- Internet Archive (Public Domain)
- Self-recorded with permission
- Licensed content with redistribution rights

### ❌ NOT Acceptable:
- YouTube extracts (copyright)
- TikTok/Instagram clips (copyright)
- Other mobile apps (copyright)
- Commercial recordings (all rights reserved)
- Unlicensed content

---

## 📁 File Structure

```
assets/
  salawat/
    salli_ala_muhammad.mp3      ⚠️ MISSING (needs download)
    salli_ala_muhammad_02.mp3   ⚠️ TO ADD
    salli_ala_muhammad_03.mp3   ⚠️ TO ADD
    salli_ala_muhammad_04.mp3   ⚠️ TO ADD
    salli_ala_muhammad_05.mp3   ⚠️ TO ADD
    README.md                    ✅ EXISTS
```

---

## 🧪 Testing Checklist

### ✅ Already Tested:
- [x] Audio catalog endpoint returns correct format
- [x] User preferences CRUD operations
- [x] Database schema migrations
- [x] FCM payload structure
- [x] Cron job logic
- [x] Timezone handling
- [x] De-duplication
- [x] Fallback behavior (missing file)

### ⏳ Pending (after audio files added):
- [ ] Stream 5 different voice clips
- [ ] Select audio in preferences
- [ ] Receive FCM push with selected audio
- [ ] Play audio in Flutter app
- [ ] Test all 5 clips end-to-end

---

## 🚀 Deployment Status

### Production Endpoints:
```
https://noorapp-backend-production.up.railway.app/api/v1/salawat/audio
https://noorapp-backend-production.up.railway.app/api/v1/salawat/media/salli_ala_muhammad.mp3
https://noorapp-backend-production.up.railway.app/api/v1/profile/salawat-preferences
```

### Swagger Documentation:
```
https://noorapp-backend-production.up.railway.app/
```
**Tag:** "Salawat Audio"

---

## 🔄 Flutter Integration

### Existing Integration Points:

1. **Audio Picker:**
   ```dart
   GET /salawat/audio
   // Display clips list
   // Let user select one
   ```

2. **Save Selection:**
   ```dart
   PATCH /profile/salawat-preferences
   {
     "audioClipId": "salli_ala_muhammad_voice"
   }
   ```

3. **FCM Handler:**
   ```dart
   if (payload["type"] == "SALAWAT") {
     String? audioUrl = payload["audioUrl"];
     // Play notification with audio
   }
   ```

✅ **Status:** Flutter contract preserved (additive changes only)

---

## 📝 Next Steps

### Immediate (to complete feature):

1. **Find 3-5 voice recordings:**
   - Search Freesound.org for "salli ala muhammad" / "صلي على محمد"
   - Verify CC0 or Public Domain license
   - Download high-quality MP3 files

2. **Add to catalog:**
   - Place files in `assets/salawat/`
   - Update `src/shared/constants/salawat-audio.ts`
   - Add entries with stable IDs: `salawat_01`, `salawat_02`, etc.

3. **Test:**
   - Verify all files stream correctly
   - Test FCM delivery with each clip
   - Confirm Flutter playback

4. **Deploy:**
   ```bash
   git add assets/salawat/*.mp3
   git commit -m "feat: add 5 salawat voice recordings"
   git push origin main
   ```

### Future Enhancements (optional):

- [ ] Add more voice variations
- [ ] Support user-uploaded custom audio
- [ ] Analytics on clip selection
- [ ] A/B test notification engagement

---

## 🎯 Summary

**Feature Status:** ✅ **100% IMPLEMENTED** (pending audio files)

**What works:**
- ✅ All APIs
- ✅ Database schema
- ✅ FCM integration
- ✅ Cron scheduling
- ✅ User preferences
- ✅ Flutter contract

**What's needed:**
- ⚠️ 3-5 quality voice MP3 files saying "صلِّ على محمد ﷺ"

**Blocking:** None (fallback to notification tones works)

**Risk:** Low (existing infrastructure proven)

---

## 📞 Support

**Setup Guide:** `SALAWAT_AUDIO_SETUP.md`

**Audio Source:** https://freesound.org/people/ibrahim_baig/sounds/788917/

**License:** CC0 1.0 (Public Domain)
