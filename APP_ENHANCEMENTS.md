# App enhancements backlog

Ideas for future performance work and product features. Nothing here is required for the current release; treat as a prioritized menu.

## Performance

- **Silent vs full dashboard reload** — Prefer silent refresh (already started for pull-to-refresh) everywhere; avoid swapping the whole Home into shimmer on resume/locale ticks unless data is missing.
- **Debounce `/dashboard` fetches** — Coalesce lifecycle + countdown-zero + pull-to-refresh into one in-flight request with a short cooldown (e.g. 5–10s).
- **Offline cache TTL / invalidation** — Version cached dashboard and Quran lists; expire stale prayer schedules after midnight local time.
- **Isolate JSON parse for Mushaf pages** — Large page payloads can jank the UI thread; parse in a background isolate when opening the reader.
- **List virtualization** — Ensure Surah / Juz / favorites lists use efficient builders; avoid rebuilding the entire Home on countdown ticks (selector already helps for the timer).
- **Font & asset caching** — Preload Quran Arabic fonts and critical SVG icons during splash; avoid decode spikes on first Home frame.
- **Startup DI / splash timing** — Defer non-critical registrations (Qibla sensors, outbox flush) until after first frame.
- **Image memory** — Cap decode size for khatmah / decorative assets on low-RAM devices.
- **Network batching** — After claim / page-read bursts, single dashboard refresh instead of many fine-grained GETs.

## Product & UX

- **Challenges tab** — Full list + detail + claim (`GET /challenges`, `POST /challenges/:id/claim`) as in the Flutter integration guide.
- **Badges & Journey tab** — Replace the Journey placeholder with streaks, badges, and history; surface `streakDays` on Home.
- **Notifications bell** — Wire unread count + list (`/notifications/*`).
- **Azan** — Implement scheduled prayer alerts per [AZAN_FEATURE.md](AZAN_FEATURE.md).
- **Share ayah card** — Export verse-of-the-day / reader ayah as a branded image.
- **Reading streak calendar** — Month view of days with Quran pages read.
- **Accessibility text scale** — Honor system textScaler beyond Mushaf font size; audit RTL overflow.
- **Widget / golden tests** — Cover claim flow, pull-to-refresh silent path, and guest local page progress.
- **Monetization** — AdMob placements per [GOOGLE_ADS_MONETIZATION.md](GOOGLE_ADS_MONETIZATION.md) without hurting prayer / reading flows.
- **Sadaqah journey task** — Real contribution flow or remove the stub metric.
- **Server wallet reconciliation** — After local-first points, add a clear “synced / pending” state when remote claim succeeds/fails.

## Related docs

- [FLUTTER_INTEGRATION_GUIDE.md](FLUTTER_INTEGRATION_GUIDE.md) — API contracts (2026-08-22)
- [BACKEND_REQUIREMENTS.md](BACKEND_REQUIREMENTS.md) — Remaining backend checklist (P0–P2)
- [BACKEND_DATA_CONTRACT.md](BACKEND_DATA_CONTRACT.md) — Remaining payload shapes still needed from backend
- [AZAN_FEATURE.md](AZAN_FEATURE.md) — Azan design
- [GOOGLE_ADS_MONETIZATION.md](GOOGLE_ADS_MONETIZATION.md) — Ads plan
