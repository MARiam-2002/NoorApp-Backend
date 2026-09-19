# 🎵 Salawat Audio Setup Guide

**Feature:** Salawat Reminder Audio Selection  
**Status:** Backend ready, audio files needed  
**Last Updated:** 2026-09-20

---

## 🎯 Goal

Add **3-5 high-quality voice recordings** of "صلِّ على محمد ﷺ" to complete the Salawat Reminder feature.

---

## ✅ What's Already Done

- ✅ All backend APIs implemented
- ✅ Database schema ready
- ✅ FCM push notification integration
- ✅ Audio streaming service
- ✅ User preferences system
- ✅ Swagger documentation

---

## ⚠️ What's Missing

**3-5 voice MP3 files saying ONLY:** "صلِّ على محمد ﷺ"

### Current Audio Status:

| Clip ID | File Name | Status | Issue |
|---------|-----------|--------|-------|
| `salli_ala_muhammad_voice` | `salli_ala_muhammad.mp3` | ⚠️ Missing | Needs manual download |
| `peaceful_reminder_tone` | `meditation_bell.mp3` | ✅ Works | Generic tone (not voice) |
| `calm_chime` | `soft_chime.mp3` | ✅ Works | Generic tone (not voice) |

**Need to add:** 2-4 more voice recordings

---

## 📋 Audio Requirements

### Must Have:
- ✅ **Phrase:** ONLY "صلِّ على محمد ﷺ"
- ✅ **Duration:** 2-5 seconds
- ✅ **Language:** Clear Arabic voice
- ✅ **Format:** MP3
- ✅ **License:** CC0, Public Domain, or redistribution allowed

### Must NOT Have:
- ❌ Additional sentences or phrases
- ❌ Background music
- ❌ Sound effects
- ❌ Introductions/outros
- ❌ Copyrighted content

---

## 🔍 Recommended Audio Sources

### Option 1: Freesound.org (Best Option)

**Already identified:**
- **File:** Sale'ala'Muhammad by ibrahim_baig
- **URL:** https://freesound.org/people/ibrahim_baig/sounds/788917/
- **License:** CC0 1.0 (Public Domain)
- **Duration:** ~2 seconds
- **Status:** ⚠️ Needs manual download (authentication required)

**How to download:**
1. Visit https://freesound.org
2. Create free account (if needed)
3. Go to https://freesound.org/people/ibrahim_baig/sounds/788917/
4. Click "Download" button
5. Save as `salli_ala_muhammad.mp3`

**Search for more:**
- Search terms: "salli ala muhammad", "salawat", "durood", "صلي على محمد"
- Filter by: CC0 license, duration 1-5 seconds

### Option 2: Pixabay.com

**Identified clips:**
- Sale'ala'Muhammad by Ibra7imbey
- Duration: 0:02
- Status: Listed but website blocks automated access

**How to access:**
1. Visit https://pixabay.com/sound-effects/search/islam/
2. Search for "Sale'ala'Muhammad" or "sallallahu alayhi wa sallam"
3. Download directly from browser
4. Verify license is "Pixabay License" (free for commercial use)

### Option 3: Internet Archive

**URL:** https://archive.org
- Search for "salawat muhammad" or "durood shareef"
- Filter by: Public Domain, Audio
- Download high-quality recordings

### Option 4: Self-Record

If you have access to a native Arabic speaker:
- Record clean pronunciation of "صلِّ على محمد ﷺ"
- Use decent microphone
- Remove background noise
- Export as MP3 (128-320 kbps)
- License: You own the rights

---

## 📁 File Placement

### Directory Structure:
```
assets/
  salawat/
    README.md                      ✅ EXISTS
    salli_ala_muhammad.mp3         ⚠️ NEEDS DOWNLOAD
    salli_ala_muhammad_02.mp3      ⚠️ TO ADD
    salli_ala_muhammad_03.mp3      ⚠️ TO ADD
    salli_ala_muhammad_04.mp3      ⚠️ TO ADD (optional)
    salli_ala_muhammad_05.mp3      ⚠️ TO ADD (optional)
```

### Naming Convention:
- Use descriptive, stable names
- Keep Arabic-friendly characters minimal in filenames
- Stick to: `a-z`, `0-9`, `_`, `-`
- Example: `salli_ala_muhammad_male_01.mp3`

---

## 🛠️ Step-by-Step Setup

### Step 1: Download Audio Files

**Manual download required** (authentication/anti-scraping):

1. **From Freesound.org:**
   ```
   1. Login to freesound.org
   2. Visit: https://freesound.org/people/ibrahim_baig/sounds/788917/
   3. Click "Download"
   4. Save as: salli_ala_muhammad.mp3
   ```

2. **From Pixabay.com:**
   ```
   1. Visit: https://pixabay.com/sound-effects/search/islam/
   2. Search: "Sale'ala'Muhammad"
   3. Click on result by Ibra7imbey
   4. Download MP3
   5. Rename to: salli_ala_muhammad_02.mp3
   ```

3. **Find 1-3 more variations:**
   - Different voices (male/female)
   - Different pronunciations (standard/tajweed)
   - Different tones (calm/energetic)

### Step 2: Place Files

```bash
# Copy downloaded files to project
cp ~/Downloads/salli_ala_muhammad*.mp3 assets/salawat/

# Or on Windows:
# Move files to: C:\Users\Mariam Khaled\Desktop\NoorApp-Backend\assets\salawat\
```

### Step 3: Update Audio Catalog

Edit: `src/shared/constants/salawat-audio.ts`

**Current catalog** (needs expansion):

```typescript
export const SALAWAT_AUDIO_CLIPS: SalawatAudioClipDef[] = [
  {
    id: 'salli_ala_muhammad_voice',
    title: 'Salli ala Muhammad (voice)',
    titleAr: 'صلِّ على محمد (صوت)',
    creator: 'ibrahim_baig',
    creatorAr: 'ibrahim_baig',
    source: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    license: 'CC0-1.0',
    attribution: "Sale'ala'Muhammad by ibrahim_baig (Freesound), CC0 1.0",
    durationSeconds: 2,
    playback: 'file',
    listenUrl: 'https://freesound.org/people/ibrahim_baig/sounds/788917/',
    youtubeUrl: null,
    spotifyUrl: null,
    mediaFile: 'salli_ala_muhammad.mp3',
    relativePath: 'salawat/salli_ala_muhammad.mp3',
    format: 'mp3',
    selectable: true,
  },
  // ... existing tone clips ...
];
```

**Add new entries** for each additional file:

```typescript
{
  id: 'salli_ala_muhammad_02',
  title: 'Salli ala Muhammad (voice 2)',
  titleAr: 'صلِّ على محمد (صوت ٢)',
  creator: 'Ibra7imbey',
  creatorAr: 'Ibra7imbey',
  source: 'https://pixabay.com/sound-effects/...',
  license: 'Pixabay License',
  attribution: "Sale'ala'Muhammad by Ibra7imbey (Pixabay)",
  durationSeconds: 2,
  playback: 'file',
  listenUrl: 'https://pixabay.com/sound-effects/...',
  youtubeUrl: null,
  spotifyUrl: null,
  mediaFile: 'salli_ala_muhammad_02.mp3',
  relativePath: 'salawat/salli_ala_muhammad_02.mp3',
  format: 'mp3',
  selectable: true,
},
```

**Rules:**
- Each `id` must be unique
- Each `mediaFile` must match actual filename
- Always include `source` and `license`
- Keep `durationSeconds` accurate
- Set `selectable: true` for picker display

### Step 4: Verify Files Locally

```bash
# Check files exist
ls -la assets/salawat/*.mp3

# Expected output:
# meditation_bell.mp3
# soft_chime.mp3
# salli_ala_muhammad.mp3
# salli_ala_muhammad_02.mp3
# salli_ala_muhammad_03.mp3
# (optional: 04, 05)
```

### Step 5: Test API Locally

```bash
# Start dev server
npm run dev

# Test audio catalog
curl http://localhost:3000/api/v1/salawat/audio | jq

# Expected: all clips show "available": true

# Test file streaming
curl http://localhost:3000/api/v1/salawat/media/salli_ala_muhammad.mp3 --output test.mp3

# Play test.mp3 to verify
```

### Step 6: Commit and Deploy

```bash
# Stage audio files
git add assets/salawat/*.mp3
git add src/shared/constants/salawat-audio.ts

# Commit with descriptive message
git commit -m "feat: add 5 salawat voice recordings (CC0/Public Domain)

- salli_ala_muhammad.mp3 (ibrahim_baig, Freesound, CC0)
- salli_ala_muhammad_02.mp3 (Ibra7imbey, Pixabay)
- salli_ala_muhammad_03.mp3 (...)
- All recordings say only 'صلِّ على محمد ﷺ'
- Duration: 2-5 seconds each
- Completes Salawat Reminder audio selection feature"

# Push to production
git push origin main
```

### Step 7: Verify Production

```bash
# Wait for Railway deployment (~2 minutes)

# Test production catalog
curl https://noorapp-backend-production.up.railway.app/api/v1/salawat/audio | jq '.data.availableCount'

# Expected: 5 (or 3+ depending on how many added)

# Test production streaming
curl https://noorapp-backend-production.up.railway.app/api/v1/salawat/media/salli_ala_muhammad.mp3 --output prod_test.mp3

# Verify file size > 0 bytes
ls -lh prod_test.mp3
```

---

## 🧪 Testing Checklist

After adding files, test:

### Backend:
- [ ] `GET /salawat/audio` returns all clips
- [ ] `availableCount` matches number of files
- [ ] Each clip shows `"available": true`
- [ ] `GET /salawat/media/{file}` streams each MP3
- [ ] Files play correctly in browser/media player
- [ ] File sizes reasonable (20-200 KB each)

### User Flow:
- [ ] Create account / login
- [ ] `GET /profile/salawat-preferences` shows default
- [ ] `PATCH /profile/salawat-preferences` with `audioClipId`
- [ ] Preferences saved correctly
- [ ] Enable reminder: `"enabled": true`

### FCM Push:
- [ ] Wait for scheduled cron (or trigger manually)
- [ ] Receive push notification on device
- [ ] Notification payload includes `audioUrl`
- [ ] Audio URL points to correct file
- [ ] Audio plays in Flutter app

---

## 📊 Expected Final State

### Audio Catalog:

| ID | Name | Creator | Duration | License | Status |
|----|------|---------|----------|---------|--------|
| `salli_ala_muhammad_voice` | صلِّ على محمد (صوت) | ibrahim_baig | 2s | CC0 | ✅ |
| `salli_ala_muhammad_02` | صلِّ على محمد (صوت ٢) | Ibra7imbey | 2s | Pixabay | ✅ |
| `salli_ala_muhammad_03` | صلِّ على محمد (صوت ٣) | ... | 3s | CC0 | ✅ |
| `salli_ala_muhammad_04` | صلِّ على محمد (صوت ٤) | ... | 2s | Public Domain | ✅ |
| `salli_ala_muhammad_05` | صلِّ على محمد (صوت ٥) | ... | 4s | CC0 | ✅ |
| `peaceful_reminder_tone` | نغمة تذكير هادئة | Freesound | 4s | CC0 | ✅ |
| `calm_chime` | رنين هادئ | Freesound | 2s | CC0 | ✅ |

**Total:** 7 clips (5 voice + 2 tones)

### API Response:
```json
{
  "data": {
    "count": 7,
    "selectableCount": 7,
    "availableCount": 7,
    "fileCount": 7,
    "clips": [ /* all 7 clips */ ]
  }
}
```

---

## 🚨 Troubleshooting

### Problem: File not streaming (404)

**Cause:** Filename mismatch

**Fix:**
```typescript
// In salawat-audio.ts:
mediaFile: 'salli_ala_muhammad.mp3'  // Must match actual filename exactly

// Check actual file:
ls assets/salawat/salli_ala_muhammad.mp3
```

### Problem: "available": false in API

**Cause:** File missing or path wrong

**Fix:**
```bash
# Verify file exists
ls -la assets/salawat/*.mp3

# Check relativePath in code matches
relativePath: 'salawat/salli_ala_muhammad.mp3'
```

### Problem: Audio won't play

**Causes:**
- Corrupted download
- Wrong format (not MP3)
- Too large (>5 MB)

**Fix:**
```bash
# Check file integrity
file assets/salawat/salli_ala_muhammad.mp3
# Expected: "Audio file with ID3 version..."

# Check size
du -h assets/salawat/salli_ala_muhammad.mp3
# Expected: 20K - 200K

# Re-encode if needed
ffmpeg -i input.mp3 -codec:a libmp3lame -b:a 128k output.mp3
```

### Problem: License unclear

**Action:** DO NOT USE the file

**Alternatives:**
- Find different recording with clear license
- Self-record with permission
- Commission recording (hire voice actor)

---

## 📖 License Documentation

For each audio file, document:

```markdown
### salli_ala_muhammad.mp3
- **Source:** https://freesound.org/people/ibrahim_baig/sounds/788917/
- **Creator:** ibrahim_baig
- **License:** CC0 1.0 Universal (Public Domain)
- **Permission:** ✅ Commercial use allowed
- **Attribution:** Required (provided in API response)
- **Downloaded:** 2026-09-20
```

Keep this in: `assets/salawat/README.md`

---

## ✅ Success Criteria

Feature is complete when:

1. ✅ 3-5 voice MP3 files in `assets/salawat/`
2. ✅ All files are CC0/Public Domain/Licensed
3. ✅ `GET /salawat/audio` returns all clips available
4. ✅ Each file streams successfully
5. ✅ Flutter app can select and play each clip
6. ✅ FCM push delivers correct audio URL
7. ✅ License information documented

---

## 📞 Support

**Status Doc:** `SALAWAT_FEATURE_STATUS.md`

**Primary Source:** https://freesound.org/people/ibrahim_baig/sounds/788917/

**Backend Lead:** Mariam Khaled

**Deadline:** None (feature works with fallback tones)

---

**Last Updated:** 2026-09-20  
**Next Step:** Download audio files from Freesound/Pixabay
