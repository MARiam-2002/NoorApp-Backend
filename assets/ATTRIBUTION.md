# Noor App — Azan & notification audio attribution

## Azan (AlAdhan mirrors — self-hosted for reliability)

Source: [AlAdhan Download Adhans](https://aladhan.com/download-adhans).  
Mirrored under `/api/v1/azan/media/` because `cdn.aladhan.com` intermittently returns **502 Bad Gateway**. Islamic Network has confirmed apps may bundle these Adhan files.

| id | Recording | Local file | Original CDN |
|----|-----------|------------|--------------|
| `mishary_alafasy` (default) | Dubai One TV — Mishary Rashid Alafasy | `azan/mishary_alafasy.mp3` | `…/a4.mp3` |
| `mishary_alafasy_2` | Another Adhan — Mishary Rashid Alafasy | `azan/mishary_alafasy_2.mp3` | `…/a7.mp3` |
| `mishary_alafasy_3` | Yet Another Adhan — Mishary Rashid Alafasy | `azan/mishary_alafasy_3.mp3` | `…/a9.mp3` |

Credit AlAdhan / Islamic Network; mu’adhin performance rights remain with the reciter.

Other requested famous muezzins remain in API `famousVoicesAudit` as unavailable until a reliable source exists.

## Notification tones (Freesound) — self-hosted

| File | Source | License | UI name |
|------|--------|---------|---------|
| `notification/soft_chime.mp3` | freesound.org/s/750607/ | CC0 | Very Soft Notification (default) |
| `notification/meditation_bell.mp3` | freesound.org/s/140128/ | CC0 | Prayer Reminder |
| `notification/singing_bowl.mp3` | freesound.org/s/616335/ | CC0 | Calm Reminder |
| `notification/xylophone_chime.mp3` | freesound.org/s/850177/ | CC0 | Gentle Spiritual Chime |
| `notification/bell_chime.mp3` | freesound.org/s/411089/ | CC BY 4.0 | Soft Bell |
| `notification/hand_bell.mp3` | freesound.org/s/339809/ | CC BY 4.0 | Soft Hand Bell |

Quran recitation audio is separate (`/quran/audio`) and was not modified.
