# Noor App — Azan & notification audio attribution

## Azan (mirrored for reliable playback)

### AlAdhan / Islamic Network
Source: https://aladhan.com/download-adhans

| id | Recording | Local file |
|----|-----------|------------|
| `mishary_alafasy` (default) | Dubai One TV — Mishary Rashid Alafasy | `azan/mishary_alafasy.mp3` |
| `mishary_alafasy_2` | Another Adhan — Mishary Rashid Alafasy | `azan/mishary_alafasy_2.mp3` |
| `mishary_alafasy_3` | Yet Another Adhan — Mishary Rashid Alafasy | `azan/mishary_alafasy_3.mp3` |

### Assabile Adhan catalog
Source: https://www.assabile.com/adhan-call-prayer

| id | Recording | Local file |
|----|-----------|------------|
| `ali_mulla` | Ali Ibn Ahmad Mala — Masjid Al-Haram | `azan/ali_mulla.mp3` |
| `yasser_al_dosari` | Yasser Al-Dosari — Saudi | `azan/yasser_al_dosari.mp3` |
| `nasser_al_qatami` | Nasser Al Qatami — Riyadh | `azan/nasser_al_qatami.mp3` |
| `abdul_basit` | Abdulbasit Abdusamad — Fajr Egypt | `azan/abdul_basit.mp3` |
| `mohamed_minshawi` | Mohamed Siddiq El-Minshawi — Egypt | `azan/mohamed_minshawi.mp3` |
| `mohamed_rifaat` | Muhammad Refaat — Cairo | `azan/mohamed_rifaat.mp3` |

Served via `/api/v1/azan/media/{file}`. Mu’adhin performance rights remain with the reciter. See API `famousVoicesAudit` for priority voices still unavailable.

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
