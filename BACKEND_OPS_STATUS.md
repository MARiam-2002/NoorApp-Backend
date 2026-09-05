# Backend ops status — 2026-09-05

**Full Flutter handoff:** [FLUTTER_BACKEND_READY_HANDOFF.md](./FLUTTER_BACKEND_READY_HANDOFF.md)

| Priority | Item | Status |
|----------|------|--------|
| P0 | Firebase → `fcm.configured: true` | **Done** |
| P0 | Cron `/cron/prayer-reminders` | **Endpoint ready**; live scheduler test **postponed** until deploy |
| P1 | Password-reset inbox | SMTP `readyForDelivery: true` |
| — | Signup `DATABASE_ERROR` | **Fixed** (pending migration applied) |

Production contract audit: **pass** (auth + dashboard + journey + Quran + Adhkar + prayers + azan + FCM tokens). Cron live send not executed.
