# Noor — "التسميع مع معلّم" (Quran Recitation Teacher Marketplace)
# Backend Master Architecture & Implementation Plan

**Status:** PLAN ONLY. No production code, schema or migration has been changed.
**Date:** 2026-10-02
**Scope:** paid 1-to-1 Quran recitation / memorization lessons: teachers, availability, booking, MyFatoorah payment, Zoom, attendance, evaluation, homework, progress, reviews, teacher earnings, settlements, admin, audit.
**Companion document:** [`FLUTTER_RECITATION_FEATURE_MASTER_PLAN.md`](../FLUTTER_RECITATION_FEATURE_MASTER_PLAN.md)

Legend used in this document:

- **LEGAL REVIEW REQUIRED** — a technical control exists, but whether it satisfies the law in a given country must be confirmed by a lawyer. Nothing here is a legal claim.
- **PROVIDER CONFIRMATION REQUIRED** — behaviour depends on Mariam's MyFatoorah / Zoom account configuration and must be confirmed with the provider.
- **DECISION** — a product decision for Mariam (collected in §29).

---

## Table of contents

1. Executive summary
2. Repository audit (what exists today)
3. Reuse map
4. Architectural principles
5. Domain architecture
6. Roles & authorization
7. Database design
8. Booking state machine
9. Availability engine
10. Payment architecture (MyFatoorah)
11. Multi-Vendor (Suppliers) evaluation
12. Money model: commission, fees, ledger, settlements
13. Zoom architecture
14. Webhooks
15. Attendance
16. Recitation evaluation
17. Homework, learning plans & progress
18. Reviews
19. Teacher onboarding
20. Notifications
21. API contract
22. Error codes & frontend behaviour
23. Security
24. Privacy & compliance
25. Admin & operations
26. Jobs, recovery & reconciliation
27. Observability
28. Performance & scale
29. Decisions required from Mariam
30. Test strategy
31. Migration, deployment & rollback
32. Risks
33. Implementation roadmap (16 phases)
34. Acceptance criteria (feature-level)

---

## 1. Executive summary

- Build the feature **inside the existing Express 5 + TypeScript + Prisma 6 modular monolith** as a new `learning` module (routes → controllers → services → Prisma), the same layering the repo uses today. No microservices, no new queue infrastructure.
- **No new roles in the database enum.** "Student" = any authenticated user. "Teacher" = a user with an `APPROVED` `TeacherProfile`. "Admin" = the existing `UserRole.ADMIN`, which is finally enforced by a new `requireAdmin` middleware.
- **The booking row is the lesson.** One `LearningBooking` carries the schedule, the commercial state and the lesson outcome; Zoom, attendance, evaluation and payments hang off it. This avoids two parallel state machines.
- **Double booking is impossible at the database level** via PostgreSQL `EXCLUDE USING gist` constraints on teacher, student and Zoom host time ranges.
- **MyFatoorah V3 hosted payment page.** The backend creates the payment, owns the amount, and only a **signature-verified webhook or a server-side `GET /v3/payments/{paymentId}` call** can mark it paid. The Flutter redirect is never trusted.
- **Zoom Server-to-Server OAuth with a pool of Noor-owned licensed host users.** Students get a per-student **registrant** join link (gives reliable attendance identity through `registrant_id`). Teachers get a freshly fetched `start_url` on demand; it is never stored and never sent to students.
- **Durable outbox (`LearningJob` table)** driven by the existing per-minute in-process scheduler on Railway provides retries and recovery (payment succeeded but Zoom failed → booking stays `CONFIRMED` with `zoomStatus=FAILED`, auto-retried, then escalated to admin; the student is never charged twice and the booking is never silently cancelled).
- **Append-only financial ledger** for teacher earnings; settlements are **manual bank payouts in the MVP**, with MyFatoorah Multi-Vendor as a later option (requires activation + per-teacher KYC).
- **Evaluations are immutable and versioned**; overall progress is a derived, rebuildable cache.
- **Everything ships behind feature flags**, default off, with additive-only migrations.

---

## 2. Repository audit (what exists today)

Audited on 2026-10-02 from the repository at `NoorApp-Backend` (excluding `dist/`, `node_modules/`). Facts only.

### 2.1 Platform

| Area | Finding | Location |
|---|---|---|
| Runtime | Node `24.x`, Express `^5.2.1`, TypeScript `^5.8.3` (`strict`, `noUncheckedIndexedAccess`, `module: NodeNext`), relative imports only | `package.json`, `tsconfig.json` |
| ORM / DB | Prisma `^6.19.3`, PostgreSQL (Neon). Columns are camelCase (quoted), tables mapped to snake_case plural via `@@map` | `prisma/schema.prisma` |
| Validation | zod `^4.4.3`; two near-identical `validate()` middlewares (`src/lib/validation.ts`, `src/shared/utils/validator.ts`) | |
| Logging | winston (JSON in production) + morgan with query strings stripped; request IDs via `X-Request-ID` | `src/lib/logger.ts`, `src/middleware/common.ts`, `src/middleware/http.ts` |
| Security middleware | `trust proxy 1`, helmet (CSP), cors from `CORS_ORIGIN`, compression, hpp, cookie-parser, JSON body limit 10 MB | `src/middleware/http.ts`, `src/app.ts` |
| Rate limiting | `express-rate-limit` in-memory store. Global `/api/v1` limiter (default 2000 / 15 min, keyed by token hash or IP) + auth-specific limiters | `src/middleware/http.ts`, `src/routes/auth.ts` |
| Redis | Configuration only; no client library installed; nothing connects | `src/lib/redis.ts` |
| Queues / workers | **NOT PRESENT** | |
| Webhooks / raw body / HMAC | **NOT PRESENT** | |
| Payments | **NOT PRESENT** (only sadaqah tracking amounts, `Decimal(10,2)`, currency hard-coded `EGP`) | `src/shared/constants/sadaqah.ts` |
| File uploads / object storage | **NOT PRESENT** (unused `STORAGE_PROVIDER` config) | `src/config.ts` |
| Audit logs | **NOT PRESENT** | |
| Admin API / panel | **NOT PRESENT**. `UserRole.ADMIN` exists but **no code checks roles**. `Roles` / `Permissions` constants exist but are unused | `src/shared/constants/roles.ts`, `permissions.ts` |
| Tests | Standalone `tsx` scripts with `node:assert/strict`; in-process HTTP tests via `createApp().listen(0)` against a **real database**; production smoke scripts | `scripts/*.ts`, `package.json` `test` |
| Swagger | `swagger-jsdoc` from `@openapi` JSDoc blocks in route files | `src/lib/swagger.ts` |

### 2.2 Request pipeline (`src/app.ts`)

`requestIdMiddleware` → `requestDiagnosticsMiddleware` → security middlewares → morgan → **`express.json({ limit: '10mb' })`** → urlencoded → `GET /` → `legalRouter` (`/privacy`, `/delete-account`) → Swagger → `app.use('/api/v1', apiRateLimiter, v1Router)` → `notFoundHandler` → `errorHandler`.

**Consequence:** JSON is parsed before any router. Zoom webhook signatures are computed over the **raw body**, so webhook routes must be mounted **before** `express.json` (see §14).

### 2.3 Response envelope (`src/shared/utils/response.ts`)

Success:

```json
{ "success": true, "message": "...", "data": {}, "meta": {}, "timestamp": "2026-10-02T13:00:00.000Z", "requestId": "uuid" }
```

Error (`code` is top-level; `X-Error-Code` header also set):

```json
{ "success": false, "message": "...", "code": "VALIDATION_ERROR", "blame": "FLUTTER_CLIENT", "nextCheck": "...", "errors": [{ "field": "x", "message": "...", "code": "too_big" }], "details": {}, "timestamp": "...", "requestId": "..." }
```

- Single error class `AppError(message, statusCode, code, details?)` (`src/lib/errors.ts`); codes are the `ErrorCodes` const in `src/config.ts`.
- `errorHandler` maps `ZodError` → 400, Prisma P2002 → 409 `CONFLICT`, P2025 → 404, P2003/P2000 → 400; production hides internals.
- Offset pagination meta: `{ page, limit, total, totalPages, hasNextPage, hasPreviousPage }` via `sendPaginated`. Query names are inconsistent today (`limit` vs `perPage`); the learning module will use **`page` + `limit`** (default 20, max 50).

### 2.4 Authentication & identity

- HS256 access JWT (`{ userId, email }`, 1 h) + rotating hashed refresh tokens (90 d). Email/password and Google; Apple **NOT PRESENT**.
- `authenticate` loads the user from the DB on every request, rejects `isActive=false`, sets `req.user = { sub, email, role }` (**role comes from the DB**, not the token). `optionalAuthenticate` supports guests.
- `User` already stores `timezone` (IANA, default `Africa/Cairo`), `country`, `city`, `latitude/longitude`, `fullName`, `avatarUrl`, `phone`.

### 2.5 Account deletion (`hardDeleteUserAccount`, `src/services/auth.service.ts:380`)

Hard delete in one transaction: upsert `DeletedIdentity`, delete tokens, `user.delete()`; every user-owned table cascades. **This must change for the learning module**: financial and booking records cannot cascade away (see §24.4).

### 2.6 Notifications

- `sendPushToUser(userId, payload)` (`src/services/device.service.ts:79`) → `sendFcmToTokens` (`src/lib/fcm.ts`), removes invalid tokens, logs via `push-diagnostics`.
- `createNotification({...})` (`src/services/notification.service.ts:205`) writes the in-app inbox row (`titleAr/En`, `bodyAr/En`, `deepLink`, `payload`).
- Idempotency pattern: per-feature `*SendLog` tables with `@@unique([userId, occurrenceKey])`, claimed **before** sending (at-most-once).
- `NotificationType` enum; the list contract collapses some types (`mapNotificationTypeToContract`).

### 2.7 Jobs

- In-process scheduler `src/lib/reminder-scheduler.ts` ticks ~1.5 s after every minute, **only on Railway** (`server.ts` starts it; the Vercel entry `api/index.js` does not).
- HTTP fallback `POST /api/v1/cron/prayer-reminders` guarded by `CRON_SECRET` (`src/routes/cron.ts`), called by Railway Cron.
- No DB locks; one in-memory `inFlightRun` guard per process.

### 2.8 Time & Quran data

- Per-user local day: `getUserLocalCalendarDay(userId)` (`src/shared/utils/user-local-date.ts:35`); tz inference `inferTimezoneFromCoordinates` (`src/shared/utils/prayer-location.ts:17`); Morocco tzdata patch `src/lib/timezone-corrections.ts`; 12-hour display `formatClock12` (`src/services/prayer.service.ts:177`).
- Some services still use **server-local** dates (`src/utils/date.ts`). The learning module must never do this.
- Quran canonical identifiers: `Surah.id` Int 1..114; ayah = composite **(`surahId`, `ayahNumber`)** (`Ayah.id` is a UUID; there is no global 1..6236 index). Catalog `CATALOG_SURAHS` (`src/data/surahs.ts`) has `totalAyahs`. Range validation precedent: `src/services/ai/intent/quran-reference-parser.ts` (reasons `AYAH_OUT_OF_RANGE`, `INVALID_RANGE`, ...).

### 2.9 Home & Journey

- `GET /dashboard` (`src/services/dashboard.service.ts`) builds sections with `Promise.all`, each with its own fallback; there are documented **additive** precedents (`nawafel?`, `sunrise?`). A `learning` card can be added the same way.
- `/journey/*` is daily good-deed tracking with an aggregate `/journey/dashboard`.

### 2.10 Deployment

- **Two live deployments of the same API**: Railway (`npm start`, long-lived, runs the scheduler, healthcheck `/api/v1/health`) and Vercel (`api/index.js` wrapper, 8.5 s watchdog → 504, no scheduler).
- **Migrations are not applied by `prisma migrate deploy`.** `runMigrationsIfNeeded()` in `src/app.ts` runs on production boot, splits each `migration.sql` on `;` at line ends, executes statements with `$executeRawUnsafe`, and **logs failing statements as non-fatal warnings**. 29 migrations, latest `20260926040000_khatmah_plan_reminder`.
- Local `.env` points to the **production** database (known from prior work). Tests that write data must not run against it for this feature (see §30.1).

### 2.11 Flutter app (not in this repository)

The Flutter source is not on this machine. Its architecture is known from `PAGES_DATA_MAP.md` and the Flutter handoff docs: `lib/features/<feature>/{data,domain,presentation}`, Cubits (flutter_bloc), GetIt (`lib/core/di/service_locator.dart`), Dio `ApiClient` that unwraps the envelope and refreshes tokens, an **offline write outbox** (`lib/core/storage/offline_outbox.dart`), 5 bottom tabs via `NavCubit`, deep links `noorapp://...`. Details are in the Flutter plan.

---

## 3. Reuse map

| Need | Reuse | New |
|---|---|---|
| Auth / identity | `authenticate`, `optionalAuthenticate`, `User` | — |
| Admin authorization | `UserRole.ADMIN` (already loaded from DB into `req.user.role`) | `requireAdmin` middleware (`src/middleware/auth.ts`) |
| Teacher authorization | — | `requireApprovedTeacher` / `loadTeacherContext` middleware |
| Envelope, errors, pagination | `sendSuccess`, `sendPaginated`, `AppError`, `errorHandler`, `asyncHandler` | New `ErrorCodes` entries |
| Validation | `src/lib/validation.ts` `validate()` (the majority path) | Learning zod schemas |
| Push + inbox | `sendPushToUser`, `createNotification`, `*SendLog` pattern | `LearningNotificationLog`, one `NotificationType` value |
| Scheduling | `reminder-scheduler.ts` tick on Railway, `CRON_SECRET` HTTP fallback | `runLearningJobs()` called from the tick; `POST /cron/learning-jobs` |
| Time zones | `User.timezone`, `prayer-location.ts` helpers, `timezone-corrections.ts`, `formatClock12` | `zonedWallTimeToUtc()` helper for availability expansion |
| Quran identifiers & validation | `Surah` table, `CATALOG_SURAHS`, range-check approach from `quran-reference-parser.ts` | `validateQuranRange()` shared util (no 50-ayah cap) |
| External HTTP | `fetchWithTimeout` + `provider-cooldown.ts` pattern | `MyFatoorahClient`, `ZoomClient` |
| Home card | `dashboard.service.ts` additive section pattern | `learning` section |
| Account deletion | `hardDeleteUserAccount` | Learning-aware pre-step (§24.4) |
| Logging / request IDs | winston logger, `requestId` | Learning log fields (§27) |
| Tests | `scripts/test-*.ts` + `node:assert` + in-process HTTP | Fake provider implementations |

Explicitly **not** created: a second user table, a second auth system, a second push system, Redis, a message queue, a separate admin service.

---

## 4. Architectural principles

1. Backend is the source of truth for availability, price, booking state, payment state, Zoom readiness, attendance, evaluation, progress and money.
2. Providers (MyFatoorah, Zoom) are inputs to reconcile, never the source of truth for Noor state.
3. Every state change is a **conditional update** (`UPDATE ... WHERE id = ? AND status IN (allowed)`) inside a transaction; zero rows updated → 409.
4. Every external call is wrapped by a durable record written **before** the call (outbox / attempt row), so a crash can be reconciled.
5. Every webhook is authenticated, stored, deduplicated, and processed idempotently.
6. Money is integer minor units + ISO currency; historical rows are never updated in place (append-only ledger, versioned evaluations, status history).
7. All instants stored as UTC `timestamptz`; the relevant IANA timezone is stored alongside where it matters.
8. Additive-only API and schema changes; feature flags default off.

---

## 5. Domain architecture

Module layout (new files only; follows existing layering):

```
src/
  routes/learning.ts                 # /api/v1/learning/* (student + teacher + public)
  routes/admin-learning.ts           # /api/v1/admin/learning/*
  routes/webhooks.ts                 # /api/v1/webhooks/* (mounted before express.json)
  controllers/learning/*.controller.ts
  services/learning/
    teacher-onboarding.service.ts
    teacher-profile.service.ts
    availability.service.ts
    pricing.service.ts
    booking.service.ts               # owns the booking state machine
    payment.service.ts               # MyFatoorah orchestration
    refund.service.ts
    zoom.service.ts                  # meetings, registrants, host pool
    attendance.service.ts
    evaluation.service.ts
    homework.service.ts
    progress.service.ts
    review.service.ts
    ledger.service.ts
    settlement.service.ts
    learning-notification.service.ts
    learning-audit.service.ts
    learning-jobs.service.ts         # outbox runner
    learning-policy.service.ts
  lib/providers/myfatoorah.client.ts
  lib/providers/zoom.client.ts
  lib/crypto/field-encryption.ts     # AES-256-GCM via node:crypto
  shared/utils/quran-range.ts
  shared/utils/zoned-time.ts
```

| Domain | Owns | Talks to |
|---|---|---|
| Teacher onboarding | `TeacherApplication`, review workflow | Profile, Audit, Notifications |
| Teacher profile | `TeacherProfile`, `TeacherQualification`, `TeacherPriceOption`, `TeacherPayoutAccount` | Admin approval |
| Availability | `TeacherAvailabilityRule`, `TeacherAvailabilityException`, slot computation | Booking (reads active bookings), Zoom host capacity |
| Booking | `LearningBooking`, `BookingStatusEvent`, state machine, cancellation policy | Payment, Zoom, Ledger, Notifications |
| Payment | `PaymentTransaction`, MyFatoorah calls, payment webhooks | Booking |
| Refund | `PaymentRefund` | Payment, Ledger |
| Lesson / Zoom | `ZoomHostAccount`, `ZoomMeeting`, join links | Booking, Attendance |
| Attendance | `LessonAttendanceSegment`, attendance summary on booking, outcome rules | Booking, Ledger |
| Evaluation | `RecitationEvaluation`, `EvaluationSegment`, `EvaluationMistake` | Progress, Homework |
| Homework | `Homework` | Evaluation |
| Learning progress | `StudentLearningPlan`, `StudentQuranProgress` (derived) | Evaluation |
| Reviews | `TeacherReview` | Profile (cached rating) |
| Earnings | `TeacherLedgerEntry` | Booking outcome, Refund |
| Settlements | `TeacherSettlement` | Ledger, Payout account |
| Notifications | `LearningNotificationLog` + existing Notification/FCM | All |
| Admin | admin routes, recovery actions | All |
| Audit | `LearningAuditLog` | All privileged and money-moving actions |

Cross-domain rule: services call each other through exported functions, and **only `booking.service.ts` changes `LearningBooking.status`**.

---

## 6. Roles & authorization

### 6.1 Role model

| Actor | How it is determined | Storage change |
|---|---|---|
| Guest | No token | — |
| Student | Any authenticated active user | — |
| Teacher | Authenticated user whose `TeacherProfile.status = APPROVED` | New `TeacherProfile` table |
| Teacher applicant | Authenticated user with a `TeacherProfile` in `APPLIED` / `UNDER_REVIEW` / `REJECTED` | same |
| Suspended teacher | `TeacherProfile.status = SUSPENDED` | same |
| Admin | `User.role = ADMIN` (existing enum value) | — |
| System | Jobs, webhooks | — |

Rationale: a teacher can also be a student (same account), so "teacher" is a capability, not an exclusive role. **No new `UserRole` values.** Admin users are granted manually via a script (`scripts/grant-admin.ts`, audited) — never via an API.

### 6.2 Middleware

- `requireAdmin`: after `authenticate`, `req.user.role === 'ADMIN'` else 403 `FORBIDDEN`. The role is read from the DB on every request, so revocation is immediate.
- `loadTeacherContext`: resolves `TeacherProfile` by `req.user.sub`; attaches `req.teacher`. Variants: `requireTeacherProfile` (any status) and `requireApprovedTeacher` (403 `TEACHER_NOT_APPROVED`).

### 6.3 Authorization rules (object-level)

| Action | Who | Rule |
|---|---|---|
| Browse approved teachers | Anyone | Only `APPROVED` and not hidden; no private fields |
| Book | Student | Cannot book self (`teacher.userId != req.user.sub`); teacher must be `APPROVED`; consent present |
| View booking / lesson | Student, the teacher, admin | `booking.studentId == sub` OR `booking.teacherId == req.teacher.id` OR admin |
| Pay | Student who owns the booking | Status `PENDING_PAYMENT`, hold not expired |
| Cancel | Student owner / teacher of booking / admin | Policy-dependent (§8.4) |
| Join (student link) | Student owner | Status `CONFIRMED`, Zoom `READY`, inside join window |
| Join (host start URL) | Teacher of booking | Same + approved or suspended-with-existing-booking (admin choice; default allowed so the lesson still happens) |
| Submit / correct evaluation | Teacher of booking | Booking `COMPLETED` (or `DISPUTED`), inside evaluation window, latest version only |
| View evaluation | Student owner, teacher, admin | — |
| Review teacher | Student owner | Booking `COMPLETED`, one per booking, within window |
| View student progress | Student; a teacher with ≥1 `CONFIRMED`/`COMPLETED` booking with that student; admin | No global student directory for teachers |
| Earnings / settlements (own) | Teacher | `teacherId == req.teacher.id` |
| Approve teachers, prices, refunds, settlements, disputes, policies | Admin | Audited with mandatory reason |

Identifiers from the client are **never** used to determine "who am I": `studentId` always comes from `req.user.sub`; the teacher for teacher endpoints comes from `req.teacher`; prices come from the DB.

---

## 7. Database design

### 7.1 Conventions

- Prisma models in `prisma/schema.prisma`, tables `@@map`ped to snake_case plural, columns camelCase (matches existing schema).
- IDs: `String @id @default(uuid())`.
- Instants: `DateTime @db.Timestamptz(3)` for all new learning tables (existing tables use `timestamp(3)`; using `timestamptz` here makes range constraints unambiguous).
- Money: `Int` minor units (`amountMinor`) + `currency String @db.Char(3)`. Currency exponent table in code (`EGP 2, SAR 2, AED 2, QAR 2, KWD 3, BHD 3, OMR 3, JOD 3`). `Int` covers up to ~21 million in a 2-decimal currency per row, which is sufficient for single lessons and settlements; use `BigInt` only if a single settlement could exceed that (**DECISION**: keep `Int`).
- User foreign keys on historical/financial tables use `onDelete: SetNull` plus snapshot fields; personal-only tables use `Cascade`; teacher profile uses `Restrict` (handled explicitly at account deletion).
- Constraints Prisma cannot express (exclusion constraints, partial unique indexes) are written as raw SQL in the same migration and verified by a schema check (§31.3).

### 7.2 Models proposed (and models deliberately not created)

Created (29):

| # | Model | Why it exists |
|---|---|---|
| 1 | `TeacherProfile` | Live, bookable teacher identity, status, public profile |
| 2 | `TeacherApplication` | Immutable snapshot of each submission + review decision (supports re-application after rejection) |
| 3 | `TeacherQualification` | Ijazah / certificates with verification state |
| 4 | `TeacherPriceOption` | Admin-approved duration → price pairs |
| 5 | `TeacherPayoutAccount` | Encrypted payout details for settlements |
| 6 | `TeacherAvailabilityRule` | Weekly recurring windows in the teacher's timezone |
| 7 | `TeacherAvailabilityException` | Blocked periods, holidays, extra one-off windows |
| 8 | `LearningPolicy` | Versioned configuration: commission, cancellation, attendance, windows |
| 9 | `LearningConsent` | Versioned consents (learning terms, guardian attestation, teacher agreement) |
| 10 | `LearningBooking` | The booking **and** the lesson (schedule, price snapshot, state, attendance summary) |
| 11 | `BookingStatusEvent` | Append-only status history (who, when, why) |
| 12 | `PaymentTransaction` | One row per payment attempt with provider IDs |
| 13 | `PaymentRefund` | One row per refund request |
| 14 | `ProviderWebhookEvent` | Every inbound MyFatoorah / Zoom event, deduplicated |
| 15 | `ZoomHostAccount` | Pool of Noor-owned licensed Zoom users (capacity) |
| 16 | `ZoomMeeting` | Provider meeting for a booking, encrypted join link |
| 17 | `LessonAttendanceSegment` | Join/leave intervals per participant |
| 18 | `RecitationEvaluation` | Versioned, immutable evaluation per lesson |
| 19 | `EvaluationSegment` | Quran ranges covered with scores |
| 20 | `EvaluationMistake` | Optional per-ayah mistakes |
| 21 | `Homework` | Assignment with lifecycle |
| 22 | `StudentLearningPlan` | Current plan / goal |
| 23 | `StudentQuranProgress` | Derived per-surah verified coverage (rebuildable cache) |
| 24 | `TeacherReview` | One review per completed booking |
| 25 | `TeacherLedgerEntry` | Append-only earnings ledger |
| 26 | `TeacherSettlement` | Payout batches |
| 27 | `LearningAuditLog` | Append-only audit trail |
| 28 | `LearningJob` | Durable outbox / retry queue |
| 29 | `LearningNotificationLog` | Push idempotency (existing `*SendLog` pattern) |

Not created (and why):

| Suggested | Decision |
|---|---|
| `BookingHold` / `BookingLock` | Merged into `LearningBooking` (`PENDING_PAYMENT` + `holdExpiresAt`); the exclusion constraint is the lock |
| `TeacherLesson` | The booking is the lesson (1:1 always, since group lessons are out of scope) |
| `TeacherSpecialization` table | Postgres enum array on `TeacherProfile` (fixed, small list) |
| `PaymentWebhookEvent` + `ZoomWebhookEvent` | One `ProviderWebhookEvent` table with a `provider` column |
| `LessonAttendance` summary table | Summary columns on `LearningBooking` |
| `StudentLearningProgress` (as source of truth) | Progress is derived from evaluations; `StudentQuranProgress` is only a cache |
| `LearningNotification` | Reuse existing `Notification` inbox + FCM |

### 7.3 Enums

```prisma
enum TeacherStatus { APPLIED UNDER_REVIEW APPROVED REJECTED SUSPENDED }
enum TeacherGender { MALE FEMALE }
enum TeacherAudience { MEN WOMEN CHILDREN }
enum TeacherSpecialization { HIFZ MURAJAA TAJWEED TILAWA_CORRECTION NOORANIYAH IJAZAH_PREP }
enum QualificationType { IJAZAH CERTIFICATE ACADEMIC_DEGREE OTHER }
enum PriceOptionStatus { PROPOSED APPROVED REJECTED RETIRED }
enum ApplicationStatus { SUBMITTED UNDER_REVIEW APPROVED REJECTED WITHDRAWN }
enum AvailabilityExceptionType { BLOCKED EXTRA }
enum LearningConsentType { LEARNING_TERMS GUARDIAN_ATTESTATION TEACHER_AGREEMENT }
enum BookingStatus {
  PENDING_PAYMENT CONFIRMED EXPIRED
  CANCELLED_BY_STUDENT CANCELLED_BY_TEACHER CANCELLED_BY_ADMIN
  COMPLETED NO_SHOW_STUDENT NO_SHOW_TEACHER DISPUTED
}
enum ActorType { STUDENT TEACHER ADMIN SYSTEM PROVIDER }
enum PaymentStatus { INITIATED PENDING PAID FAILED EXPIRED CANCELED }
enum RefundStatus { REQUESTED PENDING REFUNDED CANCELED FAILED }
enum RefundReason {
  STUDENT_CANCELLED TEACHER_CANCELLED TEACHER_NO_SHOW ADMIN_DECISION
  LATE_PAYMENT_SLOT_TAKEN DUPLICATE_PAYMENT DISPUTE_RESOLUTION
}
enum WebhookProvider { MYFATOORAH ZOOM }
enum WebhookStatus { RECEIVED PROCESSED IGNORED FAILED REJECTED }
enum ZoomMeetingStatus { PENDING CREATING READY FAILED CANCELLED ENDED }
enum AttendanceRole { TEACHER STUDENT UNKNOWN }
enum AttendanceSource { ZOOM_WEBHOOK ZOOM_REPORT ADMIN }
enum EvaluationSegmentKind { NEW_MEMORIZATION REVISION RECITATION }
enum MistakeCategory { FORGOTTEN WORD_CHANGE TASHKEEL TAJWEED MAKHRAJ WAQF_IBTIDA OTHER }
enum HomeworkKind { MEMORIZE REVISE LISTEN RECITE }
enum HomeworkStatus { ASSIGNED MARKED_DONE_BY_STUDENT REVIEWED CANCELLED }
enum HomeworkResult { PASSED NEEDS_WORK }
enum PlanStatus { ACTIVE PAUSED COMPLETED ARCHIVED }
enum ReviewStatus { PUBLISHED HIDDEN }
enum LedgerEntryType { LESSON_EARNING EARNING_REVERSAL ADJUSTMENT SETTLEMENT_PAYOUT }
enum SettlementStatus { DRAFT APPROVED PAID FAILED CANCELLED }
enum PayoutMethod { BANK_TRANSFER MOBILE_WALLET MYFATOORAH_SUPPLIER }
enum LearningJobStatus { PENDING RUNNING SUCCEEDED FAILED DEAD }
```

Plus one additive value on the existing `NotificationType` enum: `LEARNING` (see §20.3 for the list-contract mapping so Flutter is not broken).

### 7.4 Models (field-level)

Notation: `?` = nullable. All tables have `createdAt` (and `updatedAt` where mutable) unless stated.

#### 1. `TeacherProfile` → `teacher_profiles`

| Field | Type | Notes |
|---|---|---|
| id | uuid | Public teacher id used in URLs (never expose `userId`) |
| userId | String **unique** | FK `User`, `onDelete: Restrict` |
| status | TeacherStatus | default `APPLIED` |
| displayNameAr / displayNameEn? | String | Public name |
| gender | TeacherGender | Required for gender filtering |
| audiences | TeacherAudience[] | Who they teach |
| specializations | TeacherSpecialization[] | |
| bioAr / bioEn? | String (≤1500) | |
| languages | String[] | ISO 639-1 (`ar`, `en`, `ur`, ...) |
| country | Char(2)? | ISO 3166-1 alpha-2 |
| timezone | String | IANA; the source for availability expansion |
| riwayat | String[] | e.g. `HAFS_AN_ASIM`, `WARSH_AN_NAFI` |
| yearsExperience | Int? | |
| avatarKey? | String | Object storage key (public bucket) |
| bufferMinutes | Int default 10 | Between lessons |
| minNoticeMinutes | Int default 720 | Earliest bookable from now |
| maxHorizonDays | Int default 30 | |
| isListed | Boolean default true | Teacher can pause new bookings |
| ratingAvg | Decimal(3,2)? | Cached from reviews |
| ratingCount | Int default 0 | |
| completedLessonsCount | Int default 0 | Cached |
| teacherCancellationCount | Int default 0 | For quality monitoring |
| approvedAt? / approvedById? | | |
| suspendedAt? / suspendedReason? | | |

Indexes: `@@index([status, isListed])`, `@@index([gender, status])`. GIN indexes on `audiences`, `specializations` (raw SQL) only if listing queries need them (not needed at expected scale).
Privacy: `userId`, email and phone are never returned on public endpoints. Audit: status changes, field edits by admin.

#### 2. `TeacherApplication` → `teacher_applications`

| Field | Type | Notes |
|---|---|---|
| id | uuid | |
| teacherProfileId | FK | Cascade |
| status | ApplicationStatus | |
| submittedSnapshot | Json | Exact data submitted (immutable) |
| reviewerId? | FK User SetNull | |
| reviewNotes? (internal) / rejectionReasonAr?/En? (shown to applicant) | String | |
| submittedAt, reviewStartedAt?, decidedAt? | timestamptz | |

Partial unique: one open application per profile: `UNIQUE ("teacherProfileId") WHERE status IN ('SUBMITTED','UNDER_REVIEW')`.

#### 3. `TeacherQualification` → `teacher_qualifications`

`id, teacherProfileId (Cascade), type, title, issuer?, riwayah?, sanadNotes?, year?, documentKey? (private bucket), verifiedAt?, verifiedById?, rejectedReason?`. Index `[teacherProfileId]`. Documents are sensitive PII: private storage, short-lived signed URLs for admin only.

#### 4. `TeacherPriceOption` → `teacher_price_options`

`id, teacherProfileId, durationMinutes (15|20|30|45|60), amountMinor, currency, status, proposedAt, decidedAt?, decidedById?, decisionNote?`.
Partial unique: `UNIQUE ("teacherProfileId","durationMinutes") WHERE status='APPROVED'`.
Validation: amount within admin bands from `LearningPolicy.priceBands` (per duration, min/max).
Price changes never alter existing bookings (bookings snapshot the price).

#### 5. `TeacherPayoutAccount` → `teacher_payout_accounts`

`id, teacherProfileId unique, method, accountHolderName, detailsEncrypted (AES-256-GCM JSON: IBAN/bank/wallet), detailsLast4, encryptionKeyId, supplierCode? (MyFatoorah), verifiedAt?, verifiedById?`. Only last4 is ever returned; full details only to admin through an audited reveal action.

#### 6. `TeacherAvailabilityRule` → `teacher_availability_rules`

`id, teacherProfileId (Cascade), weekday (0=Sunday..6), startMinute (0..1439), endMinute (1..1440, > start), timezone (IANA snapshot of teacher tz when saved), effectiveFrom? (date), effectiveTo? (date)`.
Index `[teacherProfileId, weekday]`. Overnight windows are stored as two rules.

#### 7. `TeacherAvailabilityException` → `teacher_availability_exceptions`

`id, teacherProfileId, type (BLOCKED|EXTRA), startsAt, endsAt (timestamptz, UTC), reason?`.
Index `[teacherProfileId, startsAt]`. `CHECK (endsAt > startsAt)`.

#### 8. `LearningPolicy` → `learning_policies`

`id, version Int unique, isActive Boolean, currency Char(3), commissionBps Int (e.g. 2000 = 20%), gatewayFeeBorneBy ('PLATFORM'|'TEACHER'|'SPLIT'), holdMinutes Int (15), joinWindowOpensMinutes Int (10), evaluationWindowHours Int (48), disputeWindowHours Int (48), earningAvailableAfterHours Int (72), reviewWindowDays Int (14), priceBands Json, cancellationRules Json, attendanceRules Json, progressRules Json, createdById, createdAt`.
Partial unique: `UNIQUE ("isActive") WHERE "isActive" = true` (exactly one active). JSON columns are validated by zod on write. New versions only; never edited in place. Each booking stores `policyId`.

#### 9. `LearningConsent` → `learning_consents`

`id, userId (Cascade), type, version (String), acceptedAt, locale`. `@@unique([userId, type, version])`. **LEGAL REVIEW REQUIRED** for texts and whether storing consent this way is sufficient.

#### 10. `LearningBooking` → `learning_bookings`

| Field | Type | Notes |
|---|---|---|
| id | uuid | Also the **lesson id** |
| code | String unique | Human reference `NR-XXXXXX` for support |
| studentId? | FK User **SetNull** | |
| studentNameSnapshot | String | Shown to teacher; replaced on deletion |
| teacherId | FK TeacherProfile Restrict | |
| priceOptionId | FK | |
| startsAt / endsAt | timestamptz | Lesson time (UTC) |
| durationMinutes | Int | |
| blockStartsAt / blockEndsAt | timestamptz | `startsAt - 0`, `endsAt + bufferMinutes` (used by constraints) |
| studentTimezone / teacherTimezone | String | Snapshots for display and notifications |
| status | BookingStatus | |
| holdExpiresAt? | timestamptz | For `PENDING_PAYMENT` |
| policyId | FK LearningPolicy | Snapshot of rules |
| amountMinor, currency | | Price snapshot |
| commissionBps, platformFeeMinor, teacherShareMinor | Int | Computed at booking time |
| zoomHostAccountId? | FK | Assigned at hold time (capacity) |
| zoomStatus | ZoomMeetingStatus default `PENDING` | Denormalized for fast reads |
| studentNote? | String ≤500 | Lesson goal |
| confirmedAt?, cancelledAt?, cancelledByType?, cancelledById?, cancelReason? | | |
| teacherFirstJoinedAt?, studentFirstJoinedAt?, teacherPresentSeconds, studentPresentSeconds, overlapSeconds, attendanceComputedAt? | | Attendance summary |
| outcomeDecidedAt?, outcomeDecidedByType? | | |
| disputeOpenedAt?, disputeOpenedByType?, disputeReason? | | |
| version | Int default 0 | Optimistic concurrency |

Indexes: `[studentId, startsAt]`, `[teacherId, startsAt]`, `[status, holdExpiresAt]`, `[status, endsAt]`.

Database-level double-booking prevention (raw SQL in the migration):

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "learning_bookings" ADD CONSTRAINT "learning_bookings_teacher_no_overlap"
  EXCLUDE USING gist ("teacherId" WITH =, tstzrange("blockStartsAt", "blockEndsAt", '[)') WITH &&)
  WHERE ("status" IN ('PENDING_PAYMENT','CONFIRMED','COMPLETED','NO_SHOW_STUDENT','NO_SHOW_TEACHER','DISPUTED'));

ALTER TABLE "learning_bookings" ADD CONSTRAINT "learning_bookings_student_no_overlap"
  EXCLUDE USING gist ("studentId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("studentId" IS NOT NULL AND "status" IN ('PENDING_PAYMENT','CONFIRMED'));

ALTER TABLE "learning_bookings" ADD CONSTRAINT "learning_bookings_host_no_overlap"
  EXCLUDE USING gist ("zoomHostAccountId" WITH =, tstzrange("startsAt", "endsAt", '[)') WITH &&)
  WHERE ("zoomHostAccountId" IS NOT NULL AND "status" IN ('PENDING_PAYMENT','CONFIRMED'));

ALTER TABLE "learning_bookings" ADD CONSTRAINT "learning_bookings_time_order" CHECK ("endsAt" > "startsAt" AND "blockEndsAt" >= "endsAt");
```

- Each statement is a single line-terminated statement, compatible with the boot migration runner's `;` splitter (no `DO $$` blocks).
- Neon supports `btree_gist` (**PROVIDER CONFIRMATION REQUIRED** on the specific Neon project; verify with `SELECT * FROM pg_available_extensions WHERE name='btree_gist'` before Phase 1).
- Expired holds that the sweeper has not processed yet would still block a slot, so booking creation first runs, in the same transaction, `UPDATE learning_bookings SET status='EXPIRED' WHERE "teacherId"=$1 AND status='PENDING_PAYMENT' AND "holdExpiresAt" < now() AND tstzrange(...) && tstzrange(...)`.
- Exclusion violations surface as Postgres `23P01`. Prisma may not map this to a known error code, so booking insertion runs through `$queryRaw` inside the interactive transaction (or catches the error and matches the constraint name) and maps it to `409 SLOT_ALREADY_BOOKED`. This mapping is a Phase 1 acceptance test.

#### 11. `BookingStatusEvent` → `booking_status_events`

`id, bookingId (Cascade), fromStatus?, toStatus, actorType, actorUserId? (SetNull), reason?, metadata Json?, requestId?, createdAt`. Index `[bookingId, createdAt]`. Append-only (no update/delete in code).

#### 12. `PaymentTransaction` → `payment_transactions`

| Field | Type | Notes |
|---|---|---|
| id | uuid | Sent to MyFatoorah as `ExternalIdentifier` / customer reference |
| bookingId | FK Restrict | |
| provider | String `MYFATOORAH` | |
| status | PaymentStatus | |
| amountMinor, currency | | Copied from booking; never from client |
| providerInvoiceId? | String **unique** | |
| providerPaymentId? | String **unique** | Set from webhook / inquiry |
| paymentUrl? / paymentUrlExpiresAt? | | Returned to the owner only |
| paymentMethod? | String | e.g. `VISA/MASTER` |
| serviceChargeMinor?, serviceChargeVatMinor?, receivableMinor? | Int | From provider `Amount` block |
| isDuplicate | Boolean default false | Second successful payment for the same booking |
| failureCode? / failureMessage? | | Sanitized provider error |
| lastProviderStatus? / lastCheckedAt? / checkAttempts | | Reconciliation |
| initiatedAt, paidAt? | | |

Partial unique: `UNIQUE ("bookingId") WHERE status='PAID' AND "isDuplicate"=false` → at most one effective payment per booking. Index `[status, initiatedAt]`. No card data is stored (no PAN, no PanHash, no card token).

#### 13. `PaymentRefund` → `payment_refunds`

`id (sent as ExternalIdentifier), bookingId, paymentId, amountMinor, currency, reason, status, requestedByType, requestedById?, providerRefundId? unique, providerRefundReference?, failureMessage?, requestedAt, submittedAt?, completedAt?`.
Partial unique: `UNIQUE ("paymentId") WHERE status IN ('REQUESTED','PENDING')` (one open refund per payment). Business rule enforced under `SELECT ... FOR UPDATE` on the payment row: `sum(non-failed refunds) + new <= payment.amountMinor`.

#### 14. `ProviderWebhookEvent` → `provider_webhook_events`

`id, provider, eventKey, eventType, status, signatureValid, payload Json? (scrubbed), bookingId?, attempts, lastError?, receivedAt, processedAt?, requestId?`.
`@@unique([provider, eventKey])`. Event keys: MyFatoorah `Event.Reference`; Zoom `sha256(event + event_ts + object.uuid + participant.participant_uuid|"")`. Rejected (bad signature) events store no payload. Retention: 180 days for payloads (**DECISION**).

#### 15. `ZoomHostAccount` → `zoom_host_accounts`

`id, zoomUserId unique, email, label, isLicensed, isActive, notes?`. Capacity = count of `isActive AND isLicensed`.

#### 16. `ZoomMeeting` → `zoom_meetings`

`id, bookingId unique, hostAccountId, status, zoomMeetingId? unique (String, numeric id), lastMeetingUuid?, registrantId?, joinUrlEncrypted?, encryptionKeyId?, createAttempts, lastError?, readyAt?, startedAt?, endedAt?, cancelledAt?`.
The student's join URL contains an embedded passcode/token → encrypted at rest. **The host `start_url` is never stored** (it is short-lived and is fetched on demand).

#### 17. `LessonAttendanceSegment` → `lesson_attendance_segments`

`id, bookingId (Cascade), role, participantKey (registrant_id or Zoom participant uuid), joinedAt, leftAt?, source, webhookEventId?`.
`@@unique([bookingId, participantKey, joinedAt])`, index `[bookingId]`. No participant email or display name is stored.

#### 18. `RecitationEvaluation` → `recitation_evaluations`

`id, bookingId, teacherId, studentId? (SetNull→ but see §24.4), version Int, supersedesId? unique, correctionReason?, overallMemorizationScore? , overallTajweedScore?, overallFluencyScore? (0..10), notesForStudent? (≤2000), privateTeacherNotes? (≤1000, never shown to student), nextTarget Json? ({surahId, fromAyah, toAyah, textAr?}), submittedAt`.
`@@unique([bookingId, version])`. "Current" evaluation = max version. Rows are never updated after insert.

#### 19. `EvaluationSegment` → `evaluation_segments`

`id, evaluationId (Cascade), order, kind, surahId (FK Surah), fromAyah, toAyah, memorizationScore?, tajweedScore?, fluencyScore? (0..10), mistakesCount Int default 0, note?`. `CHECK (toAyah >= fromAyah AND fromAyah >= 1)`; upper bound validated in code against `Surah.totalAyahs`.

#### 20. `EvaluationMistake` → `evaluation_mistakes`

`id, segmentId (Cascade), surahId, ayahNumber, category, note? (≤300)`.

#### 21. `Homework` → `homework`

`id, studentId (Cascade), teacherId, assignedInEvaluationId, kind, surahId, fromAyah, toAyah, instructions? (≤1000), dueAt?, status, studentMarkedDoneAt?, reviewedInEvaluationId?, result?`. Index `[studentId, status]`. Student "done" is self-reported and never feeds verified progress.

#### 22. `StudentLearningPlan` → `student_learning_plans`

`id, studentId (Cascade), teacherId?, title, goal Json ({type, fromSurahId, fromAyah, toSurahId, toAyah, direction}), weeklyTargetAyahs?, status, createdByType, createdById?`.
Partial unique: `UNIQUE ("studentId","teacherId") WHERE status='ACTIVE'`.

#### 23. `StudentQuranProgress` → `student_quran_progress`

`studentId + surahId (composite id), verifiedRanges Json ([[from,to],...] merged), verifiedAyahCount, lastEvaluatedAt, lastBookingId`. Fully rebuildable from current evaluation versions (`progress.service.rebuild(studentId)`).

#### 24. `TeacherReview` → `teacher_reviews`

`id, bookingId unique, studentId? (SetNull), teacherId, rating (1..5), comment? (≤1000), status, moderatedById?, moderationReason?`. Index `[teacherId, status, createdAt]`.

#### 25. `TeacherLedgerEntry` → `teacher_ledger_entries`

`id, teacherId, type, amountMinor (signed), currency, bookingId?, refundId?, settlementId?, availableAt, description, createdByType, createdById?, createdAt`.
Uniques: `UNIQUE ("bookingId") WHERE type='LESSON_EARNING'`; `UNIQUE ("refundId") WHERE type='EARNING_REVERSAL'`; `UNIQUE ("settlementId") WHERE type='SETTLEMENT_PAYOUT'`. Index `[teacherId, availableAt]`. Never updated or deleted.

#### 26. `TeacherSettlement` → `teacher_settlements`

`id, teacherId, currency, periodStart, periodEnd, amountMinor, status, method, payoutReference?, approvedById?, approvedAt?, paidAt?, failureReason?`. Index `[teacherId, status]`.

#### 27. `LearningAuditLog` → `learning_audit_logs`

`id, actorType, actorUserId? (SetNull), action (e.g. TEACHER_APPROVED, REFUND_REQUESTED, BOOKING_CANCELLED, ZOOM_START_URL_ISSUED), entityType, entityId, before Json?, after Json?, reason?, requestId?, createdAt`. Index `[entityType, entityId, createdAt]`, `[actorUserId, createdAt]`. Append-only; secrets and full payout details are never written into `before/after`.

#### 28. `LearningJob` → `learning_jobs`

`id, type (CREATE_ZOOM_MEETING, CANCEL_ZOOM_MEETING, SUBMIT_REFUND, RECONCILE_PAYMENT, RECONCILE_REFUND, COMPUTE_ATTENDANCE, DECIDE_OUTCOME, SEND_NOTIFICATION, REBUILD_PROGRESS, ...), dedupeKey unique, payload Json, status, attempts, maxAttempts, runAfter, lockedAt?, lockedBy?, lastError?`.
Index `[status, runAfter]`.

#### 29. `LearningNotificationLog` → `learning_notification_logs`

`id, userId (Cascade), occurrenceKey, createdAt`. `@@unique([userId, occurrenceKey])` (e.g. `booking:{id}:reminder_24h`).

---

## 8. Booking state machine

### 8.1 States (deliberately small)

| State | Meaning |
|---|---|
| `PENDING_PAYMENT` | Slot held for `holdMinutes`; payment may be attempted (possibly several attempts) |
| `CONFIRMED` | Payment verified; lesson scheduled |
| `EXPIRED` | Hold elapsed without verified payment |
| `CANCELLED_BY_STUDENT` / `CANCELLED_BY_TEACHER` / `CANCELLED_BY_ADMIN` | Cancelled; refund (if any) tracked in `PaymentRefund` |
| `COMPLETED` | Attendance rules satisfied (or admin decision) |
| `NO_SHOW_STUDENT` / `NO_SHOW_TEACHER` | Attendance rules decided absence |
| `DISPUTED` | Outcome contested; admin must resolve |

Not states (tracked elsewhere to avoid state explosion):

- `PAYMENT_PROCESSING` / `PAYMENT_FAILED` → on `PaymentTransaction.status`; the booking stays `PENDING_PAYMENT` and the student may retry until the hold expires.
- `REFUND_PENDING` / `REFUNDED` → on `PaymentRefund.status`; the API exposes a derived `refundStatus` on the booking.

### 8.2 Transitions

| From | To | Trigger | Actor |
|---|---|---|---|
| (none) | `PENDING_PAYMENT` | `POST /learning/bookings` | Student |
| `PENDING_PAYMENT` | `CONFIRMED` | Verified payment (webhook or server inquiry) | System |
| `PENDING_PAYMENT` | `EXPIRED` | Hold elapsed (sweeper or lazy expiry) | System |
| `PENDING_PAYMENT` | `CANCELLED_BY_STUDENT` | Student abandons before paying | Student |
| `EXPIRED` | `CONFIRMED` | Late verified payment **and** the slot is still free (constraint succeeds) | System |
| `EXPIRED` | (stays) + full refund | Late payment, slot taken | System |
| `CONFIRMED` | `CANCELLED_BY_STUDENT` | Student cancel (refund per policy) | Student |
| `CONFIRMED` | `CANCELLED_BY_TEACHER` | Teacher cancel (always full refund) | Teacher |
| `CONFIRMED` | `CANCELLED_BY_ADMIN` | Admin (refund chosen explicitly) | Admin |
| `CONFIRMED` | `COMPLETED` / `NO_SHOW_STUDENT` / `NO_SHOW_TEACHER` | Outcome job after `endsAt + grace` | System (or Admin) |
| `COMPLETED` / `NO_SHOW_*` | `DISPUTED` | Student or teacher, within `disputeWindowHours` | Student / Teacher |
| `DISPUTED` | `COMPLETED` / `NO_SHOW_*` / `CANCELLED_BY_ADMIN` | Resolution | Admin |

Forbidden (examples): any transition out of `CANCELLED_*`; `CONFIRMED → PENDING_PAYMENT`; `COMPLETED → CONFIRMED`; student/teacher setting `COMPLETED` or `NO_SHOW_*` directly; any transition by Flutter-supplied status values.

### 8.3 Transaction & idempotency rules

- Every transition: one interactive `prisma.$transaction` doing (1) `UPDATE learning_bookings SET status=$to, version=version+1, ... WHERE id=$id AND status = ANY($allowedFrom)`; (2) if 0 rows → re-read and return the current state for idempotent replays (same target state) or 409 (`BOOKING_STATE_CONFLICT` / specific code); (3) insert `BookingStatusEvent`; (4) insert ledger/refund/job rows; (5) insert audit row for admin/teacher actions.
- Side effects that call providers (Zoom, MyFatoorah refund) are **never** done inside the DB transaction; the transaction enqueues a `LearningJob` with a deterministic `dedupeKey` (e.g. `zoom:create:{bookingId}`), and the runner executes it after commit (immediately via `setImmediate`, with the scheduler as backup).
- Notifications are enqueued the same way and deduplicated by `LearningNotificationLog`.

### 8.4 Cancellation policy (configurable; values are defaults pending **DECISION**)

| Who | When | Refund | Teacher earning |
|---|---|---|---|
| Student | Before payment | n/a | none |
| Student | ≥ 24 h before start | 100% | none |
| Student | 12–24 h before | 50% | 50% of teacher share (configurable) |
| Student | < 12 h | 0% | full teacher share |
| Teacher | any time | 100% | none + `teacherCancellationCount++` |
| Teacher no-show | — | 100% | none |
| Student no-show | — | 0% | full teacher share (configurable %) |
| Admin | any | chosen explicitly (FULL/PARTIAL/NONE) with reason | per decision |

Rules live in `LearningPolicy.cancellationRules`; the booking keeps `policyId`, so policy changes never affect existing bookings. `GET /learning/bookings/:id/cancellation-preview` returns the exact refund amount before the user confirms.

### 8.5 Notifications per transition

Created → none (UI handles it). Confirmed → student + teacher. Expired → student. Cancelled → the other party (+ refund info). Completed → student ("rate your teacher"). No-show → both. Disputed → admin alert + both. Resolved → both.

---

## 9. Availability engine

### 9.1 Inputs

Weekly rules (teacher timezone), exceptions (UTC), teacher settings (buffer, min notice, horizon, listed flag, status), approved durations, active bookings (blocking statuses), **Zoom host capacity** (active licensed hosts minus hosts already held in the interval), global `LearningPolicy`.

### 9.2 Algorithm (`availability.service.getBookableSlots`)

1. Validate request: `from` (date in the requester's timezone), `days` ≤ 14, `durationMinutes` ∈ teacher's approved options, `timezone` (IANA, defaults to `User.timezone` or `Africa/Cairo` for guests).
2. Compute the UTC window: `[startOfDay(from, requesterTz), startOfDay(from + days, requesterTz))`, clipped to `[now + minNotice, now + maxHorizonDays]`.
3. For each calendar date in the teacher's timezone overlapping the window, expand applicable rules to UTC intervals with `zonedWallTimeToUtc(date, minute, teacherTz)` (DST-safe; Morocco patch applies). Wall times that do not exist (spring-forward gap) are skipped; ambiguous times (fall-back) use the first occurrence.
4. Add `EXTRA` exceptions; subtract `BLOCKED` exceptions.
5. Subtract active bookings' `[blockStartsAt, blockEndsAt)` (expired holds ignored).
6. Generate candidate starts on a 15-minute grid (**DECISION**: 15 or 30) where `[start, start + duration + buffer)` fits entirely.
7. Capacity filter: drop candidates where overlapping active bookings with a host ≥ active licensed hosts.
8. Return slots grouped by local date in the **requester's** timezone, each with `startsAt` (UTC ISO), `endsAt`, `displayAr`/`displayEn` (12-hour via `formatClock12`).

### 9.3 Guarantees

- The API only returns slots that would pass the constraints **at the time of the read**; the DB constraints remain the final authority (a race returns `409 SLOT_ALREADY_BOOKED` and Flutter refreshes slots).
- Suspended / unlisted / non-approved teachers return an empty list (and `403 TEACHER_NOT_APPROVED` on booking).
- Flutter never computes availability.

### 9.4 Performance

At most 14 days × a few rules per teacher; one query for rules, one for exceptions, one for bookings (gist-indexed range overlap), one for host usage. No cache in the MVP; a 30-second per-teacher in-memory cache can be added if needed.

---

## 10. Payment architecture (MyFatoorah)

### 10.1 Provider facts used by this design (from MyFatoorah docs, checked 2026-10-02)

- Current API generation is **V3**: `POST /v3/payments` (Create Payment, hosted page returns `PaymentURL`), `GET /v3/payments/{paymentId}` (Get Payment Details), invoice lookup by `InvoiceId` or **`ExternalIdentifier`**, Create Refund / Get Refund Details. V2 endpoints (`SendPayment`, `ExecutePayment`, `GetPaymentStatus`, `MakeRefund`, `GetRefundStatus`, `MakeSupplierRefund`) still exist.
- Redirect appends `paymentId` to the redirection URL; MyFatoorah itself states redirection is unreliable and recommends combining **webhook + Get Payment Details**.
- **Webhook V2**: secret key mandatory; header `MyFatoorah-Signature` = Base64(HMAC-SHA256(secret, canonical string)). The canonical string is built from specific `Data` fields in a fixed order per event, `Key=Value` joined by commas, nulls → empty string:
  - `PAYMENT_STATUS_CHANGED` (code 1): `Invoice.Id, Invoice.Status, Transaction.Status, Transaction.PaymentId, Invoice.ExternalIdentifier`.
  - `REFUND_STATUS_CHANGED` (code 2): `Refund.Id, Refund.Status, Amount.ValueInBaseCurrency, ReferencedInvoice.Id`.
  - Each event has a unique `Event.Reference`. Retries are configurable (max 5, max 180 s delay). Some payment methods (e.g. KNET) can cause multiple webhooks; **a SUCCESS status is final and overrides others**.
- **Refunds**: full or partial (multiple partial refunds until fully refunded); refund currency = the account's base currency; may be executed manually by MyFatoorah finance unless "Auto Refund" is enabled; requires sufficient available balance.
- **Idempotency-Key header** (cached 250 min) is supported on `POST /v3/payments` and refund endpoints **only in Kuwait and Saudi Arabia**.
- Supported merchant countries: KWT, SAU, BHR, ARE, QAT, OMN, JOR, EGY (currency follows the account).

**PROVIDER CONFIRMATION REQUIRED:** the exact base URL for Mariam's account country (test: `https://apitest.myfatoorah.com`), the enabled payment methods, Auto Refund, webhook V2 configuration, and whether invoice expiry can be aligned to the booking hold.

### 10.2 Configuration (environment variables; names only)

`MYFATOORAH_BASE_URL`, `MYFATOORAH_API_KEY`, `MYFATOORAH_WEBHOOK_SECRET`, `MYFATOORAH_COUNTRY` (ISO-3), `LEARNING_CURRENCY` (must equal the account base currency), `LEARNING_PAYMENTS_ENABLED`, `PUBLIC_API_ORIGIN` (Railway origin used for redirect/webhook URLs). Secrets only in Railway/Vercel environment settings, never in the repo, never logged.

### 10.3 Payment creation flow

```
Flutter                     Noor API (Railway)                     MyFatoorah
  | POST /bookings/:id/payment  |                                       |
  |---------------------------->| 1. authz: owner, PENDING_PAYMENT,      |
  |                             |    hold not expired                    |
  |                             | 2. reuse open attempt if URL valid     |
  |                             | 3. INSERT PaymentTransaction INITIATED |
  |                             |    (amount from booking snapshot)      |
  |                             | 4. POST /v3/payments ----------------->|
  |                             |    Amount, Currency, ExternalIdentifier|
  |                             |    = payment.id, Redirection URL,      |
  |                             |    Idempotency-Key (KWT/SAU only)      |
  |                             |<----------- InvoiceId, PaymentURL -----|
  |                             | 5. UPDATE → PENDING, store InvoiceId   |
  |<---- { paymentUrl, expiresAt, paymentId }                            |
  | open PaymentURL in browser  |                                       |
```

- Amount, currency and customer reference come only from the DB. The request body from Flutter may only contain an optional `paymentMethod` hint from an allow-list.
- Customer data sent to MyFatoorah is minimized (display name; email only if required by the account — **DECISION**).
- Timeouts: 10 s on Railway. If the call times out, the attempt stays `INITIATED`; the next call (or the reconciliation job) looks up the invoice **by `ExternalIdentifier`** before creating a new one, which provides idempotency in countries without the `Idempotency-Key` header.
- Vercel's 8.5 s watchdog makes it unsuitable for this endpoint; Flutter should call learning write endpoints on the Railway base URL (**DECISION**, §29).

### 10.4 Verification flow (three independent paths, same idempotent function)

`payment.service.applyVerifiedStatus(paymentId, providerData)` is the only code that marks a payment `PAID`. It is reached from:

1. **Webhook** `PAYMENT_STATUS_CHANGED`: verify signature → store event (dedupe on `Event.Reference`) → call `GET /v3/payments/{paymentId}` (defense in depth: never trust the webhook body alone) → apply.
2. **Redirect return**: MyFatoorah redirects the browser to `GET /api/v1/learning/payments/return?paymentId=...` (backend, not Flutter). The backend enqueues/performs a `GET /v3/payments/{paymentId}` inquiry, then responds with a tiny HTML page that deep-links to `noorapp://learning/bookings/{bookingId}/payment-result`. The page shows no payment truth; Flutter polls the booking.
3. **Reconciliation job**: every 5 minutes, payments in `INITIATED/PENDING` older than 5 minutes (and younger than 48 h) are inquired by `ExternalIdentifier`/invoice; MyFatoorah `GetWebhooks` can also be used to recover missed events.

`applyVerifiedStatus` in one transaction:

- Lock the payment row (`SELECT ... FOR UPDATE`).
- If already `PAID` → no-op (idempotent).
- Provider says `PAID`/`SUCCESS`:
  - Booking `PENDING_PAYMENT` → set payment `PAID`, booking `CONFIRMED`, enqueue Zoom creation and notifications.
  - Booking `EXPIRED` → try to re-activate (`EXPIRED → CONFIRMED`; the exclusion constraint decides). If the slot was taken → payment `PAID` + enqueue **automatic full refund** (`LATE_PAYMENT_SLOT_TAKEN`) + notify.
  - Booking already `CONFIRMED` by another payment → mark this one `PAID` with `isDuplicate=true` + automatic full refund (`DUPLICATE_PAYMENT`).
  - Booking cancelled meanwhile → `PAID` + refund per the cancellation that happened.
- Provider says failed/canceled/expired → payment `FAILED`/`CANCELED`/`EXPIRED` **only if not already `PAID`** (out-of-order safety: SUCCESS is final). Booking stays `PENDING_PAYMENT` until the hold expires.
- Amount/currency mismatch between provider and our record → do not confirm; mark payment for admin review, alert.

### 10.5 Refund flow

1. A refund intent is created in the same transaction as the cancellation/decision: `PaymentRefund` `REQUESTED` + `LearningJob SUBMIT_REFUND (dedupeKey refund:{refundId})`.
2. The job locks the payment, re-checks the refundable balance, calls Create Refund with `ExternalIdentifier = refund.id` (+ `Idempotency-Key` where supported), stores `providerRefundId/Reference`, sets `PENDING`.
3. If the call outcome is unknown (timeout), the job first queries refund details by our identifier before retrying, so a refund is never submitted twice.
4. Completion via `REFUND_STATUS_CHANGED` webhook (verified + stored + deduped) or the refund reconciliation job → `REFUNDED`, or `CANCELED`/`FAILED` → admin queue.
5. Ledger: if a teacher earning already exists for the booking, an `EARNING_REVERSAL` entry is written (unique per refund).

Duplicate refund prevention: partial unique index (one open refund per payment) + balance check under row lock + deterministic job `dedupeKey` + provider external identifier.

### 10.6 What Flutter can and cannot do

Can: request a payment URL for its own booking, open it, poll booking status, call `payment/verify` to ask the server to re-check. Cannot: set an amount, currency, status, or mark anything paid.

---

## 11. Multi-Vendor (Suppliers) evaluation

MyFatoorah Multi-Vendors: suppliers (sub-merchants) are created via `CreateSupplier`, require document upload and **KYC approval by MyFatoorah**, and the feature itself **must be activated by the account manager**. Invoices carry `Suppliers[{SupplierCode, InvoiceShare, ProposedDepositShare}]`; refunds use `MakeSupplierRefund`; balances via `GetSupplierDashboard` / `TransferBalance`; supplier status webhooks exist.

| Aspect | MVP: Noor collects + ledger + manual payouts | Multi-Vendor |
|---|---|---|
| Activation | None | Account manager approval |
| Teacher onboarding | Payout account form | Per-teacher KYC documents, approval delay |
| Teachers outside MyFatoorah countries (e.g. Morocco, Algeria, Sudan) | Bank/wallet transfer possible | Likely impossible (**PROVIDER CONFIRMATION REQUIRED**) |
| Refund complexity | Single `MakeRefund` | Supplier deduction amounts per refund |
| Commission | Our ledger | Provider computes (`ProposedDepositShare`) |
| Payout automation | Manual (admin marks paid) | Automatic deposits |
| Legal position of holding teacher funds | **LEGAL REVIEW REQUIRED** | Provider holds/splits (also **LEGAL REVIEW REQUIRED**) |

**Recommendation:** MVP uses the ledger + manual monthly settlement. The schema already supports Multi-Vendor later (`TeacherPayoutAccount.supplierCode`, `PayoutMethod.MYFATOORAH_SUPPLIER`). Re-evaluate after the pilot. Nothing in the design assumes Multi-Vendor is enabled.

---

## 12. Money model: commission, fees, ledger, settlements

### 12.1 Pricing at booking time (all integers, minor units)

```
amountMinor        = approved TeacherPriceOption.amountMinor
platformFeeMinor   = round_half_up(amountMinor * commissionBps / 10000)
teacherShareMinor  = amountMinor - platformFeeMinor
```

Gateway fees: recorded from the provider's `Amount.ServiceCharge(+VAT)` after payment. `LearningPolicy.gatewayFeeBorneBy`:
- `PLATFORM` (default): teacher share unchanged; Noor net = platform fee − gateway fee.
- `TEACHER`: teacher earning = teacherShare − gateway fee.
- `SPLIT`: proportional.

Worked example (illustrative only; commission is configurable, not decided): price 500 EGP = 50000 minor; commission 20% → platform 10000, teacher 40000; gateway fee e.g. 1250 borne by platform → Noor net 8750; teacher ledger +40000 on completion.

### 12.2 Ledger rules

| Event | Entry | `availableAt` |
|---|---|---|
| Booking `COMPLETED` (and evaluation submitted, if `requireEvaluationForEarning`) | `LESSON_EARNING +teacherShare` | outcome time + `earningAvailableAfterHours` (dispute window) |
| Student late cancel / student no-show | `LESSON_EARNING +configured share` | same |
| Refund after an earning exists | `EARNING_REVERSAL −amount attributed` | immediate |
| Admin correction | `ADJUSTMENT ±` (reason mandatory, audited) | immediate |
| Settlement paid | `SETTLEMENT_PAYOUT −amount` | immediate |

Balances (`pending`, `available`, `paidOut`) are computed with `SUM` queries; nothing is stored as a mutable balance. Earnings are written only by the outcome/refund services, inside the same transaction as the triggering state change, with unique constraints preventing duplicates.

### 12.3 Settlements

Monthly (configurable): the job creates `DRAFT` settlements per teacher for `available` balance ≥ minimum payout → admin reviews → `APPROVED` → admin performs the bank transfer outside the system → `PAID` with `payoutReference` (writes `SETTLEMENT_PAYOUT`) or `FAILED` (no ledger entry). Every step is audited. Tax invoices / withholding: **LEGAL REVIEW REQUIRED**.

---

## 13. Zoom architecture

### 13.1 Provider facts used

- Server-to-Server OAuth app (account-level; no user consent; tokens via `account_credentials` grant, ~1 h). Meetings are created with `POST /users/{hostUserId}/meetings` (S2S must use an explicit user id, not `me`).
- Meetings hosted by **unlicensed** users end at 40 minutes; licensed hosts have no limit. Licenses attach to users; Pro allows a limited number of licenses, more require Business (**PROVIDER CONFIRMATION REQUIRED**).
- 100 meeting create/update operations per user per day.
- Meeting registration (registrants) produces a unique `join_url` per registrant; webhook participant objects carry `registrant_id`.
- Webhooks: `x-zm-signature = "v0=" + hex(HMAC-SHA256(secretToken, "v0:{x-zm-request-timestamp}:{rawBody}"))`; endpoint validation via `endpoint.url_validation` (respond within 3 s with `plainToken` + `encryptedToken = hex(HMAC-SHA256(secretToken, plainToken))`).
- Since 2026-03-02, Meeting SDK apps joining meetings outside their account need review; **not relevant** because the MVP opens the Zoom app via link (no SDK).

### 13.2 Configuration

`ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_WEBHOOK_SECRET_TOKEN`, `LEARNING_ZOOM_ENABLED`, `LEARNING_ENCRYPTION_KEY` (32-byte key, base64; key id for rotation). Required scopes (granular names to be confirmed in the Zoom Marketplace): create/read/update/delete meetings, add/read registrants, read users, read past-meeting participants (report).

Account-level Zoom settings (Mariam, in the Zoom admin portal): disable cloud and local recording, disable file transfer, restrict private chat, keep waiting room off (registration gates entry), disable "join before host".

### 13.3 Host pool & capacity

- `ZoomHostAccount` rows are Noor-owned licensed Zoom users (e.g. `host1@...`). Capacity = number of active licensed hosts.
- The host is assigned **when the hold is created** (same transaction as the booking insert), choosing any active host without an overlapping active booking. The `learning_bookings_host_no_overlap` constraint prevents two lessons on the same host at once. No free host → `409 SLOT_ALREADY_BOOKED` (the slot was not actually bookable).
- Capacity is configuration, never assumed.

### 13.4 Meeting creation (job `CREATE_ZOOM_MEETING`, dedupe `zoom:create:{bookingId}`)

1. Booking must be `CONFIRMED`; `ZoomMeeting` row upserted as `CREATING` (`createAttempts++`).
2. **Duplicate guard:** if a previous attempt may have created a meeting (unknown outcome), list the host's upcoming meetings and match the agenda marker `noor-booking:{bookingId}`; adopt it if found.
3. `POST /users/{hostZoomUserId}/meetings` with `type: 2`, `start_time` (UTC), `timezone: "UTC"`, `duration`, `topic: "تسميع — Noor"` (no personal names), `agenda: "noor-booking:{bookingId}"`, settings: `approval_type: 0` (auto-approve registrants), `registration_type: 1`, `join_before_host: false`, `waiting_room: false`, `auto_recording: "none"`, `mute_upon_entry: false`, `registrants_email_notification: false`, `registrants_confirmation_email: false`, `meeting_authentication: false`.
4. `POST /meetings/{id}/registrants` for the student with a pseudonymous name (first name only) and a Noor relay email (`student+{bookingId}@relay.<noor-domain>` or the account email — **DECISION**; Zoom requires an email for registrants) → store `registrantId` and encrypted `join_url`.
5. `ZoomMeeting.status = READY`, `booking.zoomStatus = READY`, enqueue "lesson ready" notification.
6. Failures: exponential backoff (1, 2, 5, 10, 30 min…) up to `maxAttempts` (e.g. 8); then `FAILED` + admin alert. The booking **stays `CONFIRMED`**; the student is not charged again and nothing is cancelled automatically. If still `FAILED` at `startsAt − 30 min`, an urgent admin alert fires; admin actions: retry, switch host, attach a manually created meeting (system verifies it via the API), or cancel with full refund.

Cancellation / reschedule: `CANCEL_ZOOM_MEETING` job deletes the meeting (idempotent; 404 treated as success).

### 13.5 Join flow

- `POST /learning/lessons/:id/join` (authenticated, rate limited):
  - Student: returns the decrypted registrant `join_url` only if owner, `CONFIRMED`, Zoom `READY`, and `now ∈ [startsAt − joinWindowOpensMinutes, endsAt]`.
  - Teacher: the server calls `GET /meetings/{id}` and returns the fresh `start_url` (never stored, never logged); audit `ZOOM_START_URL_ISSUED`.
- Responses carry `Cache-Control: no-store`. Flutter opens the URL with the system handler (Zoom app or browser) and never persists it.
- Students never receive the host `start_url`, the meeting passcode separately, or the host account email.

### 13.6 Zoom is not the source of truth

Noor DB owns lesson time, state and outcome. Zoom events only feed attendance and `startedAt/endedAt`. `meeting.deleted` (manual deletion in Zoom) sets `zoomStatus=FAILED` and alerts admin.

---

## 14. Webhooks

### 14.1 Mounting

New `src/routes/webhooks.ts`, mounted in `src/app.ts` **before** `express.json`:

```ts
app.use('/api/v1/webhooks', express.raw({ type: '*/*', limit: '256kb' }), webhooksRouter);
```

- Excluded from `apiRateLimiter` (mounted separately) but protected by its own generous limiter and signature checks.
- Registered provider URLs point to the **Railway** origin only (the scheduler and job runner live there; Vercel's watchdog would also risk timeouts).
- Webhooks stay enabled even if `LEARNING_ENABLED` is turned off, so payment events are never lost.

### 14.2 Common pipeline

1. Parse raw body (reject non-JSON → 400).
2. Verify signature (constant-time compare). Zoom: also reject timestamps older than 5 minutes (replay protection). MyFatoorah: no timestamp in the scheme → replay protection by `Event.Reference` dedupe + server-side status inquiry.
3. `endpoint.url_validation` (Zoom) answered immediately.
4. `INSERT ... ON CONFLICT DO NOTHING` into `ProviderWebhookEvent`; duplicate → `200` without reprocessing.
5. Respond `200` quickly (Zoom requires < 3 s), then process asynchronously (`setImmediate`) and mark `PROCESSED` / `IGNORED` / `FAILED`. Failed events are retried by the job runner and visible in admin.
6. Invalid signature → `401`, row stored with `REJECTED` and no payload, security log line.

### 14.3 Events handled

| Provider | Event | Handling |
|---|---|---|
| MyFatoorah | `PAYMENT_STATUS_CHANGED` | Inquiry + `applyVerifiedStatus` |
| MyFatoorah | `REFUND_STATUS_CHANGED` | Update refund, ledger reversal if needed |
| MyFatoorah | `DISPUTE_STATUS_CHANGED` (if enabled) | Store + admin alert (chargebacks) |
| Zoom | `meeting.started` / `meeting.ended` | `startedAt` / `endedAt`, schedule attendance computation |
| Zoom | `meeting.participant_joined` / `meeting.participant_left` | Attendance segments |
| Zoom | `meeting.deleted` | Mark Zoom failed, alert |

Out-of-order handling: payment SUCCESS is final; attendance segments are keyed by participant + join time and summarised only after the meeting ends (so order does not matter).

---

## 15. Attendance

### 15.1 Data

Segments come from Zoom participant webhooks; after `meeting.ended` (+10 min) a `COMPUTE_ATTENDANCE` job also pulls the past-meeting participants report to fill gaps (missed webhooks).

Participant identification:
- Student: `registrant_id == ZoomMeeting.registrantId`.
- Teacher: participant id equals the host user's Zoom id (the teacher joins via `start_url`, i.e. as the host).
- Others: `UNKNOWN` (e.g. a forwarded link) → flagged for admin review.

### 15.2 Summary (stored on the booking)

`teacherFirstJoinedAt`, `studentFirstJoinedAt`, `teacherPresentSeconds`, `studentPresentSeconds`, `overlapSeconds` (time both present).

### 15.3 Outcome rules (`LearningPolicy.attendanceRules`, defaults pending **DECISION**)

Evaluated by `DECIDE_OUTCOME` at `endsAt + 15 min` (or after attendance computation, whichever is later):

| Condition | Outcome |
|---|---|
| Teacher joined ≤ `teacherGraceMinutes` (10) after start **and** student joined **and** `overlapSeconds ≥ max(minOverlapMinutes (10 min), minOverlapRatio (50%) × duration)` | `COMPLETED` |
| Teacher never joined, or joined later than grace with overlap below threshold | `NO_SHOW_TEACHER` |
| Teacher present ≥ `teacherWaitMinutes` (15) and student never joined | `NO_SHOW_STUDENT` |
| Both absent | `NO_SHOW_TEACHER` (teacher is responsible for starting; **DECISION**) |
| Data missing (Zoom outage, no events, unknown participants) | Stay `CONFIRMED`, mark `needsReview`, admin decides |

- A meeting ending is **not** completion.
- Flutter never reports attendance.
- Teachers can file "student did not attend" and students "teacher did not attend" via the dispute endpoint within the window; admin resolves with full visibility of segments.

---

## 16. Recitation evaluation

### 16.1 Submission

`POST /learning/lessons/:id/evaluation` by the booking's teacher when the booking is `COMPLETED` (or `DISPUTED`) and within `evaluationWindowHours` of `endsAt`. Payload: overall scores (0–10), `segments[]` (1–10 items, each `{kind, surahId, fromAyah, toAyah, scores?, mistakesCount?, note?, mistakes?[]}`), `notesForStudent`, `privateTeacherNotes`, `nextTarget`, `homework[]` (0–5).

Validation: `surahId` 1..114 exists; `1 ≤ fromAyah ≤ toAyah ≤ Surah.totalAyahs` (shared `validateQuranRange`; no 50-ayah cap — a lesson may cover a long range; hard cap 286 per segment); mistakes' `ayahNumber` within their segment; text lengths.

Creates version 1 + segments + mistakes + homework in one transaction; enqueues "evaluation ready" + "homework assigned" notifications and `REBUILD_PROGRESS`.

### 16.2 Immutability & corrections

- No updates. `POST /learning/lessons/:id/evaluation/corrections` creates version N+1 with `supersedesId` and a mandatory `correctionReason`, allowed within the evaluation window (admin can always correct, audited).
- Students see only the latest version, with an "edited" indicator; admin sees all versions.
- Homework created by a superseded version is cancelled only if the correction explicitly replaces it.

### 16.3 Quran identifiers

Uses the repository's canonical `(surahId, ayahNumber)` and the `Surah` table. No new identifiers are invented.

---

## 17. Homework, learning plans & progress

### 17.1 Four distinct concepts

| Concept | Source | Mutability |
|---|---|---|
| Single lesson performance | `RecitationEvaluation` (current version) of that booking | Immutable (versioned) |
| Historical evaluations | All bookings' current versions | Append-only |
| Current learning plan | `StudentLearningPlan` (one active per student–teacher pair) | Editable by the teacher/student, audited |
| Overall Quran progress | `StudentQuranProgress` (derived cache) | Recomputed |

### 17.2 Progress derivation

An ayah counts as **verified memorized** when it is covered by a `NEW_MEMORIZATION` or `REVISION` segment in a current evaluation version with `memorizationScore ≥ progressRules.minScore` (default 7). Ranges are merged per surah. Example: lesson 1 Al-Baqarah 1–10 (score 8) and lesson 2 Al-Baqarah 11–20 (score 9) → verified `[[1,20]]`; both lesson records remain intact. A later low revision score does **not** erase earlier verified coverage; instead the API exposes `needsRevision` ranges (latest score below threshold) — **DECISION** on this rule.

`GET /learning/me/progress` returns totals (verified ayahs of 6236, surahs complete, juz coverage using `Ayah.juz`), per-surah ranges, active plan progress, streak of attended lessons. Rebuild is idempotent and triggered by evaluation submission/correction.

### 17.3 Homework lifecycle

`ASSIGNED` → (`MARKED_DONE_BY_STUDENT`, self-report) → `REVIEWED` with `PASSED`/`NEEDS_WORK` in the next evaluation, or `CANCELLED`. Self-reports never change verified progress.

---

## 18. Reviews

- One review per `COMPLETED` booking, by its student, within `reviewWindowDays`. Rating 1–5, optional comment (≤1000 chars).
- Published immediately; admin can hide (audited). Teacher `ratingAvg/ratingCount` recomputed in the same transaction.
- Public display shows the student's first name initial only (or "طالب"), never full names.
- Teachers cannot review students in the MVP.

---

## 19. Teacher onboarding

### 19.1 Workflow

```
(no profile) --apply--> APPLIED --admin start--> UNDER_REVIEW --approve--> APPROVED
                                              \--reject--> REJECTED --re-apply--> APPLIED
APPROVED --admin suspend--> SUSPENDED --admin reinstate--> APPROVED
```

- Application data: names, gender, audiences, specializations, bio, languages, country, timezone, riwayat, experience, qualifications (+ documents), proposed price options, teacher agreement consent.
- Approval requires: at least one verified qualification (admin checks), at least one approved price option, profile complete. Approval is audited with reviewer id.
- A teacher is **not listed or bookable** until `APPROVED`, `isListed`, has availability, and has an approved price.
- Suspension: unlisted immediately; future `CONFIRMED` bookings are listed for admin to decide (keep, or cancel with full refund — bulk action); no new bookings.
- Rejection reason is shown to the applicant in Arabic/English; internal notes are not.

### 19.2 Children & guardians

- If `CHILDREN` audience is supported, the booking flow requires a `GUARDIAN_ATTESTATION` consent ("I am the parent/guardian booking for my child, or I am an adult") before the first booking. Age is not collected in the MVP (data minimization).
- Teachers with the `CHILDREN` audience may require stronger vetting (background check) — **LEGAL REVIEW REQUIRED** per country.
- No recording, no in-app chat, no exchange of personal contact data.

### 19.3 Documents

Object storage is **not present** in the repository. Options (**DECISION**): an S3-compatible bucket (Cloudflare R2 / AWS S3) using signed URLs. This requires either adding an SDK dependency (`@aws-sdk/client-s3` + presigner) or implementing SigV4 signing with `node:crypto`. Private bucket for qualification documents (admin-only signed GETs, 5 min); public bucket/CDN for avatars. Upload via presigned PUT with content-type and size limits (PDF/JPEG/PNG, ≤ 5 MB), virus scanning optional (**DECISION**). Until storage exists, qualifications can be verified in an interview, with `documentKey` left null.

---

## 20. Notifications

### 20.1 Delivery

`learning-notification.service.notify(userId, kind, bookingId, params)`:
1. Claim `LearningNotificationLog(userId, occurrenceKey)` (existing at-most-once pattern).
2. `sendPushToUser` with Arabic title/body (12-hour times via `formatClock12` in the recipient's timezone), `data`: `{ type: "learning", kind, bookingId, deepLink, occurrenceKey }`.
3. `createNotification` inbox row with `titleAr/En`, `bodyAr/En`, `deepLink`, `payload`.

Notifications are never the source of truth; the app always re-fetches state.

### 20.2 Events

| Kind | Recipient | Trigger |
|---|---|---|
| `booking_confirmed` | Student, teacher | Payment verified |
| `payment_failed` | Student | Attempt failed (hold still active) |
| `booking_expired` | Student | Hold expired |
| `lesson_ready` | Student | Zoom ready (only if > 15 min before start; otherwise folded into the 15-minute reminder) |
| `reminder_24h` / `reminder_15m` | Both | Scheduler (dedupe per booking) |
| `lesson_cancelled_by_student` | Teacher | |
| `lesson_cancelled_by_teacher` | Student | |
| `lesson_cancelled_by_admin` | Both | |
| `no_show_recorded` | Both | Outcome |
| `evaluation_ready` | Student | Evaluation submitted |
| `homework_assigned` | Student | With evaluation |
| `review_request` | Student | 1 h after `COMPLETED` |
| `refund_initiated` / `refund_completed` | Student | Refund lifecycle |
| `teacher_application_decision` | Applicant | Approve/reject |
| `price_option_decision` | Teacher | |
| `zoom_failed_admin` / `refund_failed_admin` / `dispute_opened_admin` | Admins | Operational alerts (push to admin devices + email via existing mail service) |

### 20.3 Contract safety

Add `LEARNING` to `NotificationType` (additive). In `mapNotificationTypeToContract`, map `LEARNING → "SYSTEM"` in the existing inbox list contract until Flutter declares support, and expose the precise kind in `payload.kind` and `deepLink` (`noorapp://learning/...`). This prevents strict enum parsing in older app versions from breaking.

---

## 21. API contract

### 21.1 Conventions

- Base: `/api/v1/learning` (feature), `/api/v1/admin/learning` (admin), `/api/v1/webhooks` (providers).
- Envelope: existing `sendSuccess` / `sendPaginated` / `AppError`.
- Pagination: `page` (≥1), `limit` (default 20, max 50), meta `{ page, limit, total, totalPages, hasNextPage, hasPreviousPage }`.
- Times: ISO-8601 UTC strings (`startsAt`) plus display helpers `startsAtDisplay: { timezone, dateAr, dateEn, timeAr, timeEn }` in the requester's timezone.
- Money: `{ amountMinor: 50000, currency: "EGP", display: "500.00 ج.م" }`.
- IDs: UUIDs; teachers are always referenced by `TeacherProfile.id`.
- Feature flag: when `LEARNING_ENABLED=false`, all learning routes return `503 LEARNING_DISABLED` (webhooks excepted).
- Swagger `@openapi` blocks on every route (existing convention).
- Rate limits listed are per user (token hash) unless stated; they are in-memory per instance (§28).

Format of each entry below: **Auth/Role · Request · Validation · Response · Errors · Pagination · Rate limit · Idempotency · Authorization · Audit · Side effects.** "Std errors" = 401 `UNAUTHORIZED`/`TOKEN_EXPIRED`, 400 `VALIDATION_ERROR`, 503 `LEARNING_DISABLED`, 500.

### 21.2 Public & student endpoints

**1. `GET /learning/config`**
- Auth: optional. Request: none.
- Response: `{ enabled, paymentsEnabled, currency, durations: [15,30,45,60], joinWindowOpensMinutes, policySummary: { cancellation: [...], disputeWindowHours }, consentsRequired: [{type, version, url}], supportContact }`.
- Errors: std. Pagination: no. Rate limit: global. Idempotency: GET. Authz: none. Audit: no. Side effects: none.

**2. `GET /learning/teachers`**
- Auth: optional (guests may browse).
- Query: `gender?`, `audience?`, `specialization?`, `language?`, `durationMinutes?`, `maxPriceMinor?`, `availableWithinDays?` (1–14), `q?` (≤50), `sort?` (`recommended|rating|price_asc|price_desc`), `page`, `limit`.
- Response items: `{ id, displayNameAr, displayNameEn, gender, avatarUrl, audiences, specializations, languages, country, riwayat, yearsExperience, ratingAvg, ratingCount, completedLessonsCount, priceFrom: Money, durations[], nextAvailableAt? }`.
- Errors: std. Pagination: yes. Rate limit: 120/min. Authz: only `APPROVED` + listed. Audit: no.

**3. `GET /learning/teachers/:teacherId`**
- Auth: optional. Response: list item + `{ bioAr, bioEn, qualifications: [{type, title, issuer, riwayah, verified}], priceOptions: [{id, durationMinutes, price: Money}], reviewsPreview: [...] }`. No documents, no user ids.
- Errors: 404 `TEACHER_NOT_FOUND` (also for non-approved). Rate limit: 120/min.

**4. `GET /learning/teachers/:teacherId/availability`**
- Auth: optional. Query: `from` (YYYY-MM-DD), `days` (1–14, default 7), `durationMinutes` (required, approved option), `timezone?` (IANA).
- Response: `{ timezone, durationMinutes, priceOptionId, days: [{ date, slots: [{ startsAt, endsAt, timeAr, timeEn }] }] }`.
- Errors: 404 `TEACHER_NOT_FOUND`, 422 `DURATION_NOT_OFFERED`, 400 `INVALID_TIMEZONE`. Rate limit: 60/min. Side effects: lazy expiry not performed here (read-only).

**5. `GET /learning/teachers/:teacherId/reviews`**
- Auth: optional. Paginated `{ rating, comment, reviewerLabel, createdAt }`. Only `PUBLISHED`.

**6. `POST /learning/consents`**
- Auth: required (student). Body: `{ type: LEARNING_TERMS|GUARDIAN_ATTESTATION, version }`.
- Validation: version must equal the current version from config.
- Response: `{ type, version, acceptedAt }`. Errors: 422 `CONSENT_VERSION_OUTDATED`. Rate limit: 20/hour. Idempotency: upsert on `(userId,type,version)`. Audit: no (the consent row is the record).

**7. `POST /learning/bookings`**
- Auth: required (student).
- Body: `{ teacherId, priceOptionId, startsAt (ISO UTC), timezone (IANA), studentNote? (≤500) }`.
- Validation: teacher `APPROVED` + listed; price option approved and belongs to the teacher; `startsAt` on the grid; inside notice/horizon; slot passes availability; required consents present; not booking yourself; per-student cap of open `PENDING_PAYMENT` holds (2).
- Response `201`: booking detail (see #9) with `status: PENDING_PAYMENT`, `holdExpiresAt`.
- Errors: 409 `SLOT_ALREADY_BOOKED`, 409 `STUDENT_TIME_CONFLICT`, 403 `TEACHER_NOT_APPROVED`, 403 `CONSENT_REQUIRED`, 422 `SLOT_NOT_AVAILABLE`, 422 `CANNOT_BOOK_SELF`, 429 `TOO_MANY_PENDING_BOOKINGS`.
- Rate limit: 10/hour. Idempotency: if the same student already holds an active booking with the same teacher and `startsAt`, return it with `200`. Authz: student = token. Audit: status event. Side effects: lazy-expire overlapping stale holds, assign Zoom host, insert booking + status event.

**8. `GET /learning/bookings`**
- Auth: required. Query: `scope=upcoming|past|all` (default upcoming), `status?`, `page`, `limit`.
- Response items: `{ id, code, status, refundStatus, startsAt, endsAt, durationMinutes, startsAtDisplay, teacher: {id, displayNameAr, avatarUrl}, price: Money, zoomStatus, canJoinFrom, hasEvaluation }`.
- Authz: `studentId = sub`. Pagination: yes. Rate limit: 120/min.

**9. `GET /learning/bookings/:bookingId`**
- Auth: required. Response: list item + `{ holdExpiresAt, studentNote, cancellation: {...}?, payments: [{id, status, amount, paidAt}], refunds: [{status, amount, requestedAt, completedAt}], lesson: { joinAvailable, joinOpensAt, joinClosesAt }, evaluationSummary?, review? }`.
- Errors: 404 `BOOKING_NOT_FOUND` (also when not owned — no existence leak). Rate limit: 240/min (polling).

**10. `POST /learning/bookings/:bookingId/payment`**
- Auth: required (owner). Body: `{ paymentMethod? }` (allow-list from config).
- Response: `{ paymentId, paymentUrl, expiresAt, amount: Money }`.
- Errors: 409 `BOOKING_EXPIRED`, 409 `PAYMENT_ALREADY_PROCESSED`, 409 `BOOKING_STATE_CONFLICT`, 503 `PAYMENT_PROVIDER_UNAVAILABLE` (retryable).
- Rate limit: 10/hour per booking owner. Idempotency: returns the existing open attempt while its URL is valid; provider-side by `ExternalIdentifier`. Audit: payment row. Side effects: provider call.

**11. `POST /learning/bookings/:bookingId/payment/verify`**
- Auth: required (owner). Body: `{ paymentId? }`. Server performs a provider inquiry and applies the verified status.
- Response: booking detail. Errors: 404. Rate limit: 30/hour. Idempotency: naturally idempotent.

**12. `GET /learning/bookings/:bookingId/cancellation-preview`**
- Auth: owner. Response: `{ allowed, refund: Money, refundPercent, reasonCode, policyVersion }`.

**13. `POST /learning/bookings/:bookingId/cancel`**
- Auth: owner. Body: `{ reason? (≤300) }`.
- Response: booking detail with new status + refund. Errors: 409 `CANCELLATION_NOT_ALLOWED`, 409 `BOOKING_STATE_CONFLICT`. Rate limit: 20/hour. Idempotency: if already `CANCELLED_BY_STUDENT`, returns `200` with current state. Audit: status event. Side effects: refund intent + job, Zoom cancel job, teacher notification, ledger entry for late cancellation.

**14. `POST /learning/bookings/:bookingId/dispute`**
- Auth: owner student (teacher variant in §21.4). Body: `{ reasonCode: TEACHER_ABSENT|LESSON_TOO_SHORT|TECHNICAL_ISSUE|CONDUCT|OTHER, details (≤1000) }`.
- Errors: 409 `DISPUTE_WINDOW_CLOSED`, 409 `DISPUTE_ALREADY_OPEN`. Side effects: status `DISPUTED`, earnings availability frozen, admin alert. Audit: yes.

**15. `GET /learning/lessons/:lessonId`** (`lessonId` = booking id)
- Auth: student owner, teacher of booking, or admin. Response: role-aware lesson view `{ booking summary, role: student|teacher, counterpart: {displayName, avatarUrl}, join: {available, opensAt, closesAt, zoomStatus}, attendanceSummary (teacher/admin only), evaluation?, homework[] }`.

**16. `POST /learning/lessons/:lessonId/join`**
- Auth: student owner or teacher. Body: none.
- Response: `{ url, kind: "join"|"start", expiresHint }`, `Cache-Control: no-store`.
- Errors: 403 `LESSON_NOT_READY` (outside window / not confirmed), 409 `ZOOM_NOT_READY` (meeting being prepared; retry), 403 `FORBIDDEN`.
- Rate limit: 30/hour. Audit: teacher start URL issuance logged; student join counted (no URL logged). Side effects: Zoom API call for teacher.

**17. `GET /learning/lessons/:lessonId/evaluation`**
- Auth: student owner, teacher, admin. Response: current version `{ version, edited, submittedAt, overallScores, segments: [{kind, surahId, surahNameAr, fromAyah, toAyah, scores, mistakesCount, mistakes[]}], notesForStudent, nextTarget, homework[] }`. `privateTeacherNotes` only for teacher/admin.
- Errors: 404 `EVALUATION_NOT_FOUND`.

**18. `POST /learning/lessons/:lessonId/evaluation`** (teacher) — see §16.1.
- Errors: 403 `FORBIDDEN`, 409 `EVALUATION_ALREADY_SUBMITTED`, 409 `EVALUATION_WINDOW_CLOSED`, 409 `LESSON_NOT_COMPLETED`, 422 `INVALID_QURAN_RANGE` (with `errors[]` pointing at the segment).
- Rate limit: 30/hour. Idempotency: unique `(bookingId, version=1)`; a replay returns the existing evaluation with `200`. Audit: yes. Side effects: notifications, progress rebuild job, ledger availability if gated on evaluation.

**19. `POST /learning/lessons/:lessonId/evaluation/corrections`** (teacher)
- Body: full evaluation + `correctionReason` (required, ≤500) + `baseVersion` (optimistic concurrency).
- Errors: 409 `EVALUATION_VERSION_CONFLICT`, 409 `EVALUATION_WINDOW_CLOSED`. Audit: yes.

**20. `POST /learning/lessons/:lessonId/review`** (student)
- Body: `{ rating: 1..5, comment? }`. Errors: 409 `REVIEW_NOT_ALLOWED`, 409 `REVIEW_ALREADY_SUBMITTED`. Idempotency: unique per booking. Side effects: rating recompute.

**21. `GET /learning/me/summary`**
- Auth: required. Response (also embedded in `/dashboard` as `learning`): `{ state: "none"|"upcoming"|"soon"|"live"|"after_lesson", nextLesson?: {id, startsAt, teacher, joinOpensAt}, lastEvaluation?: {lessonId, submittedAt, overallScores}, progress: {verifiedAyahs, totalAyahs: 6236, percent} }`.

**22. `GET /learning/me/progress`** — see §17.2.

**23. `GET /learning/me/recitations`** — paginated history of current evaluations `{ lessonId, date, teacher, segmentsSummary, overallScores }`.

**24. `GET /learning/me/homework`** — query `status?`; paginated.

**25. `POST /learning/me/homework/:homeworkId/done`** — owner; idempotent (`ASSIGNED → MARKED_DONE_BY_STUDENT`); 409 `HOMEWORK_STATE_CONFLICT`.

**26. `GET /learning/me/plans`** — active and past plans.

**27. `GET /api/v1/learning/payments/return`** (HTML, public)
- Query: `paymentId`. Looks up the payment by provider payment id (or our id), triggers verification, returns minimal HTML with a deep link `noorapp://learning/bookings/{bookingId}/payment-result` and a manual "open app" button. No payment status in the page body. Rate limit: 60/min per IP.

### 21.3 Teacher application endpoints

**28. `POST /learning/teacher-applications`**
- Auth: required. Body: profile fields + `qualifications[]` + `priceOptions[]` (proposals) + `agreementVersion`.
- Errors: 409 `TEACHER_APPLICATION_EXISTS` (open application), 409 `ALREADY_TEACHER`. Rate limit: 5/day. Audit: yes. Side effects: creates/updates `TeacherProfile` (`APPLIED`), `TeacherApplication` snapshot, consent, admin notification.

**29. `GET /learning/teacher-applications/me`** — status, rejection reason (public part), submitted snapshot.

**30. `POST /learning/uploads/presign`** (after storage decision)
- Body: `{ purpose: QUALIFICATION_DOCUMENT|AVATAR, contentType, sizeBytes }` → `{ uploadUrl, key, expiresAt }`. Validation: type allow-list, ≤5 MB. Rate limit: 20/hour.

### 21.4 Teacher endpoints (`requireTeacherProfile` / `requireApprovedTeacher`)

| # | Method & path | Notes |
|---|---|---|
| 31 | `GET /learning/teacher/me` | Profile, status, settings, payout account (last4), counts |
| 32 | `PATCH /learning/teacher/me` | Partial update of bio, languages, audiences, settings, `isListed`; changes to identity-relevant fields (gender, names, qualifications) after approval require admin re-approval (**DECISION**). Audit |
| 33 | `GET /learning/teacher/me/price-options` · `POST` (propose) · `DELETE /:id` (retire) | Proposals go to admin; 422 `PRICE_OUT_OF_BAND` |
| 34 | `GET /learning/teacher/me/availability` · `PUT /learning/teacher/me/availability` | `PUT` replaces the weekly rule set atomically (`{ timezone, rules: [{weekday, start: "HH:mm", end: "HH:mm"}] }`); never affects existing bookings; 422 `INVALID_AVAILABILITY` for overlaps |
| 35 | `POST /learning/teacher/me/availability/exceptions` · `DELETE /.../:id` | Block periods / extra windows; blocking a period with confirmed bookings returns 409 `HAS_CONFIRMED_BOOKINGS` (teacher must cancel explicitly) |
| 36 | `GET /learning/teacher/me/bookings` | `scope`, paginated; student shown as first name only |
| 37 | `POST /learning/teacher/me/bookings/:bookingId/cancel` | Body `{ reason (required) }`; full refund; 409 `CANCELLATION_NOT_ALLOWED` after start. Audit |
| 38 | `POST /learning/teacher/me/bookings/:bookingId/dispute` | e.g. `STUDENT_ABSENT` within window |
| 39 | `GET /learning/teacher/me/students` | Students with ≥1 confirmed/completed booking: `{ studentKey, firstName, lessonsCount, lastLessonAt, activePlan? }` |
| 40 | `GET /learning/teacher/me/students/:studentKey/progress` | Same shape as student progress; 404 if no relationship |
| 41 | `POST /learning/teacher/me/students/:studentKey/plans` · `PATCH /plans/:planId` | Plan management; audit |
| 42 | `PATCH /learning/teacher/me/homework/:homeworkId` | Edit instructions/due date before due; audit |
| 43 | `GET /learning/teacher/me/earnings` | `{ pending, available, paidOut: Money, entries: paginated }` |
| 44 | `GET /learning/teacher/me/settlements` | Paginated |
| 45 | `PUT /learning/teacher/me/payout-account` | Encrypted; returns last4 only; audit; rate limit 5/day |

`studentKey` is an opaque per-teacher pseudonym (HMAC of `teacherId:studentId` with a server key) so teachers never learn internal user ids.

All teacher endpoints: authorization by `req.teacher.id`; 403 `TEACHER_NOT_APPROVED` where approval is required; rate limit 120/min reads, 30/hour writes.

### 21.5 Webhooks

| # | Path | Auth | Notes |
|---|---|---|---|
| 46 | `POST /api/v1/webhooks/myfatoorah` | `MyFatoorah-Signature` | §14; always `200` for valid duplicates; `401` invalid signature |
| 47 | `POST /api/v1/webhooks/zoom` | `x-zm-signature` + timestamp | Handles `endpoint.url_validation` |

### 21.6 Admin endpoints (`authenticate` + `requireAdmin`; all writes require `reason` and are audited)

The repository has no admin conventions yet; these establish them under `/api/v1/admin/learning`.

| Area | Endpoints |
|---|---|
| Applications | `GET /teacher-applications?status&page` · `GET /teacher-applications/:id` (with signed document URLs) · `POST /:id/start-review` · `POST /:id/approve` · `POST /:id/reject` |
| Teachers | `GET /teachers?status&q` · `GET /teachers/:id` · `PATCH /teachers/:id` · `POST /teachers/:id/suspend` · `POST /teachers/:id/reinstate` · `POST /teachers/:id/qualifications/:qid/verify` · `POST /teachers/:id/payout-account/reveal` (audited) |
| Prices | `GET /price-options?status=PROPOSED` · `POST /price-options/:id/approve` · `POST /price-options/:id/reject` |
| Bookings | `GET /bookings?status&from&to&teacherId&needsReview` · `GET /bookings/:id` (full timeline: status events, payments, refunds, webhooks, Zoom, attendance, audit) · `POST /bookings/:id/cancel {refund: FULL|PARTIAL|NONE, amountMinor?}` · `POST /bookings/:id/set-outcome` · `POST /bookings/:id/resolve-dispute` |
| Zoom | `POST /bookings/:id/zoom/retry` · `POST /bookings/:id/zoom/switch-host` · `POST /bookings/:id/zoom/attach {zoomMeetingId}` · `GET /zoom/hosts` · `POST /zoom/hosts` · `PATCH /zoom/hosts/:id` |
| Payments & refunds | `GET /payments?status` · `POST /payments/:id/reconcile` · `GET /refunds?status` · `POST /refunds/:id/retry` · `POST /refunds/:id/mark-completed {providerReference}` |
| Webhooks & jobs | `GET /webhook-events?provider&status` · `POST /webhook-events/:id/reprocess` · `GET /jobs?status&type` · `POST /jobs/:id/retry` |
| Money | `GET /teachers/:id/ledger` · `POST /teachers/:id/ledger-adjustments` · `GET /settlements?status` · `POST /settlements/generate {periodEnd}` · `POST /settlements/:id/approve` · `POST /settlements/:id/mark-paid {payoutReference}` · `POST /settlements/:id/mark-failed` |
| Policies | `GET /policies` · `POST /policies` (new version) · `POST /policies/:id/activate` |
| Reviews | `POST /reviews/:id/hide` · `POST /reviews/:id/publish` |
| Audit & health | `GET /audit-logs?entityType&entityId&actorUserId` · `GET /health` (counts: stuck jobs, failed webhooks, pending refunds > 24 h, Zoom failures in next 24 h, payments pending > 30 min, disputes open) |

Admin rate limit: 300/15 min. Admin endpoints return full data needed for operations but never secrets or full payout details (except the audited reveal).

---

## 22. Error codes & frontend behaviour

New `ErrorCodes` entries (added to `src/config.ts`):

| Code | HTTP | Meaning | Flutter behaviour |
|---|---|---|---|
| `LEARNING_DISABLED` | 503 | Feature off | Hide entry points, show "قريبًا" |
| `TEACHER_NOT_FOUND` | 404 | Unknown / not approved | Back to marketplace |
| `TEACHER_NOT_APPROVED` | 403 | Teacher action / booking a non-approved teacher | Teacher: application status screen; student: refresh list |
| `DURATION_NOT_OFFERED` | 422 | | Reload profile |
| `SLOT_NOT_AVAILABLE` | 422 | Outside availability | Refresh slots |
| `SLOT_ALREADY_BOOKED` | 409 | Race lost | Toast «تم حجز هذا الموعد للتو، اختر موعدًا آخر» + refresh slots |
| `STUDENT_TIME_CONFLICT` | 409 | Student has another lesson | Show conflicting lesson |
| `CANNOT_BOOK_SELF` | 422 | | Message |
| `TOO_MANY_PENDING_BOOKINGS` | 429 | Hold cap | Go to My Lessons to pay/cancel |
| `CONSENT_REQUIRED` | 403 | | Show consent sheet, retry |
| `CONSENT_VERSION_OUTDATED` | 422 | | Reload config, re-show consent |
| `BOOKING_NOT_FOUND` | 404 | | Back |
| `BOOKING_EXPIRED` | 409 | Hold elapsed | «انتهت مهلة الدفع» + rebook CTA |
| `BOOKING_STATE_CONFLICT` | 409 | Concurrent change | Refetch booking |
| `PAYMENT_ALREADY_PROCESSED` | 409 | Already paid | Refetch → confirmed screen |
| `PAYMENT_PROVIDER_UNAVAILABLE` | 503 | MyFatoorah down | Retry button (backoff) |
| `CANCELLATION_NOT_ALLOWED` | 409 | | Show policy |
| `REFUND_ALREADY_REQUESTED` | 409 | | Show refund status |
| `DISPUTE_WINDOW_CLOSED` / `DISPUTE_ALREADY_OPEN` | 409 | | Message |
| `LESSON_NOT_READY` | 403 | Outside join window / not confirmed | Show countdown |
| `ZOOM_NOT_READY` | 409 | Meeting still being prepared | «جاري تجهيز رابط الحصة» + auto retry every 15 s |
| `LESSON_NOT_COMPLETED` | 409 | Evaluation too early | Message |
| `EVALUATION_ALREADY_SUBMITTED` | 409 | | Open existing |
| `EVALUATION_WINDOW_CLOSED` | 409 | | Contact support |
| `EVALUATION_VERSION_CONFLICT` | 409 | | Reload and redo |
| `EVALUATION_NOT_FOUND` | 404 | | "Pending" state |
| `INVALID_QURAN_RANGE` | 422 | | Inline field errors |
| `REVIEW_NOT_ALLOWED` / `REVIEW_ALREADY_SUBMITTED` | 409 | | Hide CTA |
| `TEACHER_APPLICATION_EXISTS` / `ALREADY_TEACHER` | 409 | | Open status |
| `PRICE_OUT_OF_BAND` | 422 | | Show allowed band |
| `INVALID_AVAILABILITY` | 422 | | Inline |
| `HAS_CONFIRMED_BOOKINGS` | 409 | | List affected bookings |
| `HOMEWORK_STATE_CONFLICT` | 409 | | Refetch |
| `ACCOUNT_DELETION_BLOCKED` | 409 | Teacher with upcoming lessons / unsettled balance (§24.4) | Explain + support |

Generic: 401 (existing refresh/logout rules), 403 `FORBIDDEN` (generic message, no details), 404, 429 `RATE_LIMIT_EXCEEDED` (respect `RateLimit-Reset`), 500 / 503 (retry, never show internals). Internal details are never exposed (existing production `errorHandler` behaviour).

---

## 23. Security

| Topic | Control |
|---|---|
| Authentication | Existing JWT `authenticate` (DB-loaded user, `isActive` check) |
| Authorization | `requireAdmin`, `requireApprovedTeacher`, object-level checks in every service query (`where: { id, studentId: sub }` etc.) |
| IDOR | Not-owned objects return 404 (no existence leak); UUIDs; teacher ids are profile ids; student pseudonymous keys for teachers |
| Role escalation | No API sets `User.role`; admin granted by audited script; teacher approval admin-only |
| Input validation | zod on every body/query/param; length caps; enum allow-lists; Quran range validation against DB |
| Rate limiting | Per-endpoint limiters (§21) on top of the global limiter |
| Webhook auth | HMAC verification with constant-time compare; Zoom timestamp window 5 min; dedupe tables; server-side inquiry before confirming payments |
| Replay | Event-key uniqueness; payment inquiry; idempotent state transitions |
| Secrets | Env vars only; never logged; `.env` not committed; rotation procedure documented in ops runbook |
| Encryption at rest | AES-256-GCM (`node:crypto`) for Zoom join URLs and payout details, with key id for rotation; Neon provides disk encryption |
| PII minimization | Teachers see student first name only; students see public teacher profile; no emails/phones exchanged; Zoom registrant uses pseudonymous name |
| Zoom URL protection | Student join URL only to owner inside window; host start URL never stored, teacher-only, audited; `no-store` responses |
| Payment security | Hosted payment page (no card data touches Noor; PCI scope minimal); amount from DB; verification server-side |
| Child data | No age collection, guardian attestation, no recording, no chat, vetting (**LEGAL REVIEW REQUIRED**) |
| Audit | `LearningAuditLog` for admin, teacher privileged and all money actions |
| File uploads | Presigned uploads, type/size allow-list, private bucket for documents, short signed GETs |
| Abuse | Hold cap per student, booking rate limits, teacher cancellation counters, review only after completed lessons |
| Brute force | Existing auth limiters; join/payment endpoints limited |
| Transactions | Conditional updates, row locks for payments/refunds, exclusion constraints, unique partial indexes |

Never trusted from Flutter: user id, teacher id (for self), price, currency, payment status, attendance, evaluation ownership, progress.

---

## 24. Privacy & compliance

Nothing below is a claim of legal compliance.

### 24.1 New personal data

Teacher: identity, gender, qualifications documents, payout details, country, timezone, ratings. Student: bookings, payments (no card data), attendance metadata, evaluations, homework, progress, reviews, consents. Provider-side: MyFatoorah (name, possibly email/phone, card data on their page), Zoom (pseudonymous registrant name, relay email, meeting metadata).

### 24.2 Required documents & actions — **LEGAL REVIEW REQUIRED**

- Update the privacy policy (`/privacy` route, `docs/BACKEND-PRIVACY-DATA-INVENTORY.md`) and Play Store Data Safety / Apple privacy labels.
- Learning terms of service, cancellation & refund policy, teacher agreement (independent contractor vs employee), guardian consent text.
- Country-specific data protection laws (e.g. Egypt Law 151/2020, Saudi PDPL, UAE PDPL) — cross-border transfer to Zoom/MyFatoorah/Neon regions.
- Requirements, if any, for supervising paid online Quran teaching (e.g. religious-affairs authorities) per target country.
- Business registration, tax/VAT on platform commission, invoices/receipts, teacher payout tax treatment.
- Record retention periods for financial data.
- App store payment rules: Apple guideline 3.1.3(d) "Person-to-Person Services" permits non-IAP payment for real-time 1-to-1 services; Google Play policy must be checked for the same case (**STORE POLICY REVIEW REQUIRED**).

### 24.3 Retention (defaults pending legal input)

| Data | Default retention |
|---|---|
| Bookings, payments, refunds, ledger, settlements, audit logs | Financial retention period set by lawyer (placeholder: 7 years), anonymized after account deletion |
| Webhook payloads | 180 days (scrubbed) |
| Attendance segments | 1 year |
| Evaluations, homework, progress | Until account deletion |
| Teacher documents | Until teacher deletion + period set by lawyer |
| Consents | As long as the related relationship + retention period |

### 24.4 Account deletion changes (required)

`hardDeleteUserAccount` gains a learning pre-step inside the same transaction:

1. **Teacher accounts:** if the user has a `TeacherProfile` with upcoming `CONFIRMED` bookings or a non-zero available/pending balance → `409 ACCOUNT_DELETION_BLOCKED` (new code, only reachable by teachers, so existing student flows are unchanged). Otherwise anonymize the profile (status `SUSPENDED`, names → "معلم سابق", bio cleared, documents deleted from storage via job) and keep ledger/settlements.
2. **Students:** future `PENDING_PAYMENT` → `EXPIRED`; future `CONFIRMED` → `CANCELLED_BY_STUDENT` with refund per **DECISION** (recommended: full refund on account deletion); jobs enqueued (refund, Zoom cancel).
3. Booking/payment/refund rows keep `studentId = NULL` (SetNull) and `studentNameSnapshot = "مستخدم محذوف"`. Personal learning data (evaluations, homework, progress, plans, consents, notification logs) is deleted by cascade; reviews are anonymized.
4. Existing behaviour for users without learning data is unchanged.

### 24.5 Access/export

If required by applicable law (**LEGAL REVIEW REQUIRED**), add `GET /learning/me/export` returning the student's bookings, evaluations and progress as JSON.

---

## 25. Admin & operations

### 25.1 Admin UI (**DECISION**)

No admin panel exists. Options: (a) start API-only with Swagger + a small internal web dashboard later; (b) build a minimal internal web admin (separate small frontend, same API) in Phase 12. Recommended: (b) minimal, because refunds, approvals and disputes must be operable by non-developers.

### 25.2 What admins see

Teachers & statuses, applications queue, price proposals, bookings (filters, `needsReview`), payments, refunds, Zoom failures, attendance, disputes, teacher balances, settlements, webhook failures, job queue, audit events, health counters (§21.6).

### 25.3 Recovery runbook

| Situation | Automatic | Admin action |
|---|---|---|
| Payment success + Zoom failure | Booking stays `CONFIRMED`, retries with backoff, urgent alert at T−30 min | Retry, switch host, attach manual meeting, or cancel with full refund |
| Duplicate webhook | Ignored by dedupe | None |
| Failed webhook processing | Job retries; status `FAILED` visible | Reprocess |
| Missed webhook | Reconciliation job by `ExternalIdentifier` + MyFatoorah `GetWebhooks` | Manual reconcile button |
| Teacher cancellation | Full refund job, student notified | Review cancellation count |
| Student cancellation | Refund per policy | Override via admin cancel if needed |
| Refund failure / stuck > 24 h | Alert | Retry, or mark completed with provider reference after manual refund in the MyFatoorah portal |
| Teacher suspension | Unlisted; future bookings flagged | Keep or bulk-cancel with refunds |
| Zoom meeting deleted / outage | Alert, `needsReview` on outcome | Decide outcome, refund, or reschedule (cancel + rebook) |
| Payment dispute / chargeback | Stored + alert (if dispute webhook enabled) | Respond in MyFatoorah portal; ledger reversal if lost |
| Duplicate payment | Auto full refund of duplicate | Monitor |
| Late payment, slot taken | Auto full refund | Monitor |

---

## 26. Jobs, recovery & reconciliation

### 26.1 Runner

- `learning-jobs.service.runDueJobs(limit)` claims jobs with `SELECT ... FROM learning_jobs WHERE status IN ('PENDING','FAILED') AND "runAfter" <= now() ORDER BY "runAfter" LIMIT $n FOR UPDATE SKIP LOCKED` inside a short transaction, marks them `RUNNING` with `lockedAt`, then executes outside the transaction.
- Called from the existing Railway scheduler tick (added to `runReminderPass` or a sibling call in `reminder-scheduler.ts`) and from a new `POST /api/v1/cron/learning-jobs` guarded by `CRON_SECRET` (Railway Cron fallback). Also kicked immediately after commits via `setImmediate`.
- Stale `RUNNING` jobs (`lockedAt` > 10 min) return to `FAILED` for retry. After `maxAttempts` → `DEAD` + admin alert.
- Every handler is idempotent (state-conditional updates, provider lookups before creates, unique constraints).

### 26.2 Scheduled tasks

| Task | Frequency | Idempotency |
|---|---|---|
| Expire unpaid holds | every minute | Conditional `PENDING_PAYMENT → EXPIRED` where `holdExpiresAt < now()` |
| Process outbox jobs | every minute + immediate | `FOR UPDATE SKIP LOCKED`, dedupe keys |
| Reconcile payments (`INITIATED/PENDING` 5 min–48 h) | every 5 min | `applyVerifiedStatus` is idempotent |
| Recover missed MyFatoorah webhooks (`GetWebhooks`) | hourly | Event dedupe |
| Reconcile refunds (`PENDING`) | every 15 min | Status-conditional |
| Detect missing Zoom meetings (confirmed, start < 2 h, zoom not READY) | every 5 min | Enqueue create with same dedupe key |
| Lesson reminders 24 h / 15 min | every minute | `LearningNotificationLog` |
| Compute attendance (`endedAt + 10 min` or `endsAt + 20 min`) | every 5 min | Recomputes summary deterministically |
| Decide outcomes | every 5 min | Conditional `CONFIRMED → outcome` |
| Make earnings available | n/a (computed by `availableAt`) | — |
| Settlement drafts | monthly (1st, 03:00 Cairo) | Unique `(teacherId, periodEnd)` |
| Stuck refund / webhook / job detection | every 15 min | Alert dedupe per item per day |
| Review requests | every 15 min | Notification log |
| Prune webhook payloads > retention | daily | Idempotent update |

---

## 27. Observability

- **Structured logs** (existing winston JSON): every learning log line includes `requestId` (from request or job id), `bookingId`, `paymentId`, `providerInvoiceId`, `refundId`, `zoomMeetingId`, `webhookEventId`, `jobId`, `teacherId`, `userId` (ids only).
- **Never logged:** API keys, webhook secrets, Zoom tokens, join/start URLs, payout details, card data, emails, phone numbers, evaluation text.
- **Metrics:** no metrics system exists. MVP uses log-based counters (`event: learning.metric`, `name`, `value`) plus the admin `GET /admin/learning/health` counters. Key metrics: bookings created/confirmed/expired, payment success rate, time-to-confirm, Zoom creation failures, join success, outcome distribution, refunds by reason, webhook failures, job backlog.
- **Error tracking:** none installed today; Sentry (or similar) is a **DECISION** (requires a dependency).
- **Alerting:** admin push (existing FCM) + email (existing mail service) for: Zoom failed within 2 h of start, refund failed/stuck, webhook signature failures spike, job `DEAD`, payment amount mismatch, dispute opened.

---

## 28. Performance & scale

Expected scale (pilot): tens of teachers, hundreds of lessons per week. The design favours correctness and simplicity:

- Postgres constraints and indexes listed in §7; gist indexes created by the exclusion constraints also serve overlap queries.
- Pagination everywhere (max 50).
- No cache required; optional 30 s in-memory availability cache per teacher.
- Contention is limited to the same teacher/slot and handled by constraints (fast failure, no long locks).
- Webhook bursts: store-then-process with dedupe; processing via the job runner.
- Notification bursts: per-user sends through existing FCM multicast; reminders are naturally spread.
- External timeouts: MyFatoorah 10 s, Zoom 10 s; cooldown/circuit breaking via the existing `provider-cooldown.ts` pattern (keys `myfatoorah`, `zoom`).
- Connection pooling: Neon pooled connection string recommended for Railway (**PROVIDER CONFIRMATION REQUIRED** on current `DATABASE_URL`).
- **In-memory rate limits are per instance**; acceptable while Railway runs one instance. If scaled horizontally, move limits to the DB or Redis.
- Vercel: learning **write** endpoints should be called on Railway; read endpoints work on both. Jobs and webhooks are Railway-only.

---

## 29. Decisions required from Mariam

| # | Decision | Recommendation |
|---|---|---|
| D1 | MyFatoorah merchant country (sets the single currency, refund currency, idempotency support) | Country of the legal entity; pilot there |
| D2 | Commission % and who bears gateway fees | Platform bears fees; commission set after market check |
| D3 | Cancellation/refund thresholds (§8.4) | Defaults shown |
| D4 | Lesson durations, price bands, slot grid (15 vs 30 min) | 30/45/60 min, 30-min grid |
| D5 | Minors: allowed? guardian flow | Allowed with guardian attestation, no age collection |
| D6 | Gender policy: strict same-gender matching or filter only | Filter + teacher audience setting |
| D7 | Admin UI approach | Minimal internal web admin in Phase 12 |
| D8 | Object storage provider (needs a dependency or SigV4) | Cloudflare R2 with presigned URLs |
| D9 | Settlement method & frequency | Manual monthly bank/wallet transfer |
| D10 | Zoom plan and number of licensed hosts | Start with 2–3 hosts |
| D11 | Registrant email strategy for Zoom | Relay address under a Noor domain |
| D12 | Separate database for testing (Neon branch) — local `.env` points to production | Required before Phase 1 tests |
| D13 | Account deletion with upcoming lessons/balance | §24.4 defaults |
| D14 | Earnings require submitted evaluation? | Yes |
| D15 | Error tracking (Sentry) | Yes, before launch |
| D16 | Flutter base URL for learning writes (Railway vs Vercel) | Railway |
| D17 | Both-absent outcome rule and "needsRevision" progress rule | §15.3 / §17.2 defaults |
| D18 | Teacher edits after approval needing re-approval | Gender, names, qualifications only |

---

## 30. Test strategy

### 30.1 Environment

- **Must not run against the production DB.** Create a Neon branch (`learning-dev`) and a separate `.env.learning-test`; test scripts refuse to run if `DATABASE_URL` host matches production (guard in a shared test helper).
- Provider fakes: `FakeMyFatoorahClient`, `FakeZoomClient` implementing the same interfaces; contract tests against MyFatoorah **test** environment (`apitest.myfatoorah.com`) and a Zoom developer account.
- Format follows the repo: `scripts/test-learning-*.ts` with `node:assert/strict`, in-process `createApp().listen(0)`, npm scripts `test:learning-*`, added to `npm test` only when they need no external credentials.

### 30.2 Matrix

| Layer | Cases |
|---|---|
| Unit | Pricing/commission rounding per currency exponent; cancellation refund calculator; availability expansion incl. DST and Morocco; state transition table (allowed/forbidden); permission helpers; Quran range validation; progress merge; attendance outcome rules; webhook signature builders (MyFatoorah canonical strings, Zoom `v0`) with provider doc vectors |
| Integration | Booking create (hold, host assignment, lazy expiry); payment create/verify paths; webhook ingest + dedupe; refund submit/complete; Zoom create/adopt/cancel; evaluation submit/correct; notifications enqueue + dedupe; account deletion with learning data |
| E2E (student) | Browse → teacher → slot → booking → payment (fake) → webhook → confirmed → Zoom ready → join → attendance → completed → evaluation → progress → review |
| E2E (teacher) | Apply → admin approve → price approve → availability → booking → start URL → evaluation → earnings available → settlement paid |
| E2E (admin) | Approve → monitor health → cancel with refund → suspend teacher → audit trail complete |
| Race | Two students same slot (exactly one 201, one 409); same student double-submit; duplicate payment webhook; webhook + redirect simultaneously; duplicate refund requests; Zoom job double execution; late payment after expiry |
| Failure | Payment success + Zoom failure (stays confirmed, retries, admin alert); payment pending forever (reconcile); payment failure (retry allowed); webhook endpoint down (reconcile recovers); Zoom down at join; FCM unavailable (state unaffected) |
| Security | IDOR on bookings/lessons/evaluations/progress; student calling teacher/admin endpoints; teacher accessing another teacher's booking; student requesting start URL; join outside window; forged webhook signature; replayed Zoom webhook (old timestamp); price tampering in body (ignored) |
| Migration | Schema verification script finds all constraints/indexes; exclusion constraint present before enabling flag |

### 30.3 Production smoke (after each deploy, flag on for an allow-listed test teacher only)

Health; config; teacher list; availability; create booking → expire; create booking → MyFatoorah test/live small amount (if allowed) → refund; Zoom meeting creation for a test booking; webhook delivery visible in admin. Test data cleaned by booking code prefix.

---

## 31. Migration, deployment & rollback

### 31.1 Migration strategy

- One migration per phase, **additive only** (new enums, tables, columns, indexes, one enum value on `NotificationType`). No changes to existing columns.
- Raw SQL (extension, exclusion constraints, partial unique indexes, checks) appended to the Prisma-generated migration as single-line statements (compatible with the boot runner).
- `ALTER TYPE "NotificationType" ADD VALUE 'LEARNING';` as its own statement (Postgres restriction on using a new value in the same transaction).

### 31.2 Boot migration runner risk

The current runner treats statement failures as warnings. For learning migrations this could silently skip a constraint (double-booking risk). Mitigation:
1. A schema verification step (`scripts/verify-learning-schema.ts` + a runtime check at boot when `LEARNING_ENABLED=true`) that confirms tables, enum values, exclusion constraints and partial indexes exist; if anything is missing, learning endpoints return `503 LEARNING_DISABLED` and an alert is logged.
2. Recommended (**DECISION**, small change to existing infrastructure): run `prisma migrate deploy` as a release step for learning migrations, or make the runner fail loudly for migrations whose folder name contains `learning`.

### 31.3 Deployment

- Feature flags: `LEARNING_ENABLED` (routes), `LEARNING_PAYMENTS_ENABLED`, `LEARNING_ZOOM_ENABLED`, `LEARNING_PILOT_ALLOWLIST` (comma-separated user ids/emails that can book during the pilot).
- Order per phase: deploy code (flags off) → verify schema → configure provider webhooks to the Railway URL → enable for allow-list → smoke → widen.
- Provider configuration: MyFatoorah webhook V2 URL `https://<railway>/api/v1/webhooks/myfatoorah` with secret, events `PAYMENT_STATUS_CHANGED` + `REFUND_STATUS_CHANGED`, retries 5 × 180 s. Zoom app event subscriptions to `https://<railway>/api/v1/webhooks/zoom`.

### 31.4 Rollback

- Code rollback: redeploy the previous commit; tables remain (additive), unused.
- Functional rollback: set `LEARNING_ENABLED=false` (hides feature) while **webhooks keep processing** so paid bookings stay consistent; existing confirmed lessons continue via jobs unless admin cancels with refunds.
- Never drop learning tables or delete financial rows during rollback.
- Data fixes go through audited admin actions or reviewed scripts, never ad-hoc SQL on money tables.

---

## 32. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Boot migration runner skips a failing constraint silently | Double booking | Schema verification + runtime guard + `migrate deploy` (§31.2) |
| Local `.env` = production DB | Test data or damage in production | Neon test branch + test guard |
| Two deployments (Railway + Vercel) | Webhooks/jobs on the wrong host; Vercel timeouts | Webhooks/jobs Railway-only; writes via Railway |
| MyFatoorah idempotency header unavailable outside KWT/SAU | Duplicate invoices | Our attempt rows + lookup by `ExternalIdentifier` |
| Refunds executed manually by MyFatoorah / insufficient balance | Slow refunds, complaints | Enable Auto Refund, monitor balance, stuck-refund alerts |
| Single currency per merchant account | Students in other countries see foreign currency | Pilot in one country; display conversion later |
| MyFatoorah coverage limited to 8 countries for merchants; teachers elsewhere | Payout friction | Manual payouts; Multi-Vendor evaluation later |
| Zoom license capacity | Fewer bookable slots | Capacity-aware availability; buy more hosts |
| Zoom availability in some countries (e.g. sanctions) | Students cannot join | Country allow-list (**LEGAL REVIEW REQUIRED**) |
| Attendance data gaps | Wrong outcome | `needsReview` + disputes + report API reconciliation |
| Child safeguarding | Reputational/legal | No recording/chat, vetting, guardian consent, reporting channel |
| Legal status of holding teacher funds / platform licensing | Regulatory | Lawyer review before launch; Multi-Vendor option |
| In-memory rate limits | Weak protection if scaled | DB/Redis store when scaling |
| No admin UI | Operations depend on developers | Minimal admin web in Phase 12 |
| App store payment policy (Google) | Rejection | Store policy review before release |

---

## 33. Implementation roadmap (16 phases)

Each phase ships behind flags, includes its own tests, and is independently deployable.

### Phase 1 — Database & domain foundation
- **Depends on:** D12 (test DB), `btree_gist` availability check.
- **Files:** `prisma/schema.prisma`, `prisma/migrations/<ts>_learning_foundation/migration.sql`, `src/config.ts` (flags, error codes, env schema), `src/middleware/auth.ts` (`requireAdmin`, teacher context), `src/shared/utils/quran-range.ts`, `src/shared/utils/zoned-time.ts`, `src/lib/crypto/field-encryption.ts`, `src/services/learning/learning-audit.service.ts`, `learning-policy.service.ts`, `learning-jobs.service.ts`, `scripts/verify-learning-schema.ts`, `scripts/grant-admin.ts`, test helper guard.
- **Migration:** all enums + `TeacherProfile`, `TeacherApplication`, `TeacherQualification`, `TeacherPriceOption`, `LearningPolicy`, `LearningConsent`, `LearningBooking` (+constraints), `BookingStatusEvent`, `LearningAuditLog`, `LearningJob`, `LearningNotificationLog`, `NotificationType.LEARNING`. (Later tables come in later phases.)
- **APIs:** `GET /learning/config`.
- **Tests:** schema verification; exclusion constraint race test (raw inserts); zoned time; Quran range; requireAdmin.
- **Acceptance:** constraints present; parallel overlapping inserts → exactly one succeeds and maps to `SLOT_ALREADY_BOOKED`; flags off by default; no existing test regresses.
- **Rollback:** flag off; tables unused.

### Phase 2 — Teacher onboarding & admin approval
- **Files:** `routes/learning.ts` (applications), `routes/admin-learning.ts`, `services/learning/teacher-onboarding.service.ts`, `teacher-profile.service.ts`, `pricing.service.ts`, controllers; optional storage presign.
- **Migration:** `TeacherPayoutAccount` (if not in Phase 1).
- **APIs:** #28–#33, admin applications/teachers/prices.
- **Tests:** workflow transitions, re-application, approval prerequisites, audit rows, non-admin 403.
- **Acceptance:** non-approved teachers never appear in listings; every decision audited.
- **Rollback:** flag off.

### Phase 3 — Availability
- **Files:** `availability.service.ts`, teacher availability routes, public availability route.
- **Migration:** `TeacherAvailabilityRule`, `TeacherAvailabilityException`, `ZoomHostAccount` (capacity input).
- **APIs:** #2–#5, #34–#35, admin Zoom hosts.
- **Tests:** DST, Morocco UTC, overnight rules, exceptions, buffers, notice/horizon, capacity, suspended teacher.
- **Acceptance:** slots match a hand-computed fixture set for Cairo, Riyadh, Casablanca, London (DST) teachers viewed from different timezones.
- **Rollback:** flag off.

### Phase 4 — Booking engine
- **Files:** `booking.service.ts` (state machine), booking routes, hold sweeper job, cancellation calculator.
- **APIs:** #6–#9, #12–#13 (pre-payment cancel), #14 skeleton.
- **Tests:** state table, hold expiry, lazy expiry, idempotent create, student conflict, host assignment, race tests.
- **Acceptance:** 50 concurrent requests for one slot → 1 success, 49 × 409.
- **Rollback:** flag off; holds expire naturally.

### Phase 5 — MyFatoorah
- **Depends on:** D1, MyFatoorah test credentials, webhook V2 config.
- **Files:** `lib/providers/myfatoorah.client.ts`, `payment.service.ts`, `refund.service.ts`, `routes/webhooks.ts`, `src/app.ts` (raw-body mount before `express.json`), payment return HTML route, reconciliation jobs.
- **Migration:** `PaymentTransaction`, `PaymentRefund`, `ProviderWebhookEvent` (+ partial indexes).
- **APIs:** #10, #11, #27, #46, admin payments/refunds/webhooks.
- **Tests:** signature vectors; duplicate/out-of-order webhooks; redirect-before-webhook and webhook-before-redirect; late payment after expiry; duplicate payment auto-refund; refund duplicate prevention; amount mismatch.
- **Acceptance:** no path marks a payment paid without verified provider data; every money movement has audit + status events.
- **Rollback:** `LEARNING_PAYMENTS_ENABLED=false` (no new payments); webhooks continue.

### Phase 6 — Zoom
- **Depends on:** D10, D11, Zoom S2S app + webhook secret.
- **Files:** `lib/providers/zoom.client.ts`, `zoom.service.ts`, Zoom webhook handler, create/cancel jobs, join endpoint.
- **Migration:** `ZoomMeeting`.
- **APIs:** #16, #47, admin Zoom recovery.
- **Tests:** token caching/refresh; create/adopt duplicate guard; registrant; failure → retries → alert; start URL never persisted (assert DB + logs); join window.
- **Acceptance:** payment success with Zoom down leaves booking `CONFIRMED` and recoverable.
- **Rollback:** `LEARNING_ZOOM_ENABLED=false` (admins handle links manually via attach).

### Phase 7 — Lesson & attendance
- **Files:** `attendance.service.ts`, outcome job, dispute endpoints, lesson view.
- **Migration:** `LessonAttendanceSegment`.
- **APIs:** #14, #15, #38, admin set-outcome/resolve-dispute.
- **Tests:** rule matrix, missing data → needsReview, unknown participant, out-of-order segments.
- **Acceptance:** meeting end alone never completes a lesson.

### Phase 8 — Evaluation & homework
- **Files:** `evaluation.service.ts`, `homework.service.ts`.
- **Migration:** `RecitationEvaluation`, `EvaluationSegment`, `EvaluationMistake`, `Homework`.
- **APIs:** #17–#19, #24–#25, #42.
- **Tests:** immutability (no UPDATE paths), version conflict, window, range validation, visibility of private notes.

### Phase 9 — Progress
- **Files:** `progress.service.ts`, rebuild job.
- **Migration:** `StudentLearningPlan`, `StudentQuranProgress`.
- **APIs:** #21–#23, #26, #39–#41.
- **Tests:** merge ranges, corrections rebuild, teacher relationship authorization.

### Phase 10 — Reviews
- **Migration:** `TeacherReview`. **APIs:** #20, #5, admin hide/publish. **Tests:** eligibility, uniqueness, rating recompute.

### Phase 11 — Notifications
- **Files:** `learning-notification.service.ts`, scheduler hook, `notification.service.ts` mapping (`LEARNING → SYSTEM` in list contract), `dashboard.service.ts` additive `learning` section.
- **Tests:** dedupe, recipient timezone 12-hour text, no notification when state changed meanwhile.
- **Acceptance:** existing notification list contract unchanged for older app versions.

### Phase 12 — Admin & operations
- **Files:** remaining admin routes, health endpoint, settlement service, ledger service, minimal admin web (separate project, if D7).
- **Migration:** `TeacherLedgerEntry`, `TeacherSettlement` (ledger may land earlier with Phase 7 outcomes).
- **Tests:** settlement generation idempotency, audit coverage for every admin write.

### Phase 13 — Flutter student mode
- See the Flutter plan; backend supports with Swagger + handoff doc `FLUTTER_RECITATION_FEATURE_HANDOFF.md` containing real responses from the test environment.

### Phase 14 — Flutter teacher mode
- Same; teacher endpoints frozen before this phase.

### Phase 15 — E2E testing
- Full matrix §30 on the test branch with MyFatoorah test and a Zoom dev account; pilot users on production with allow-list.

### Phase 16 — Production hardening
- Load test booking/availability; alerting thresholds; runbook; legal documents published; store submissions; account deletion changes verified; key rotation drill; widen allow-list.

---

## 34. Acceptance criteria (feature-level)

1. A student can complete browse → book → pay → join → receive evaluation → see progress, with every state confirmed by the backend.
2. No two active bookings ever overlap for the same teacher, student, or Zoom host (database-enforced, proven by race tests).
3. No booking becomes `CONFIRMED` without a verified MyFatoorah status; duplicate/out-of-order webhooks never double-process.
4. Refunds are never submitted twice and never exceed the paid amount.
5. Payment success with Zoom failure always ends in a recoverable `CONFIRMED` booking visible to admin.
6. Students never receive host/start URLs; join URLs are only returned to the owner inside the window.
7. Evaluations are never modified in place; corrections are versioned and audited.
8. Every admin action and every money movement has an audit record.
9. All lesson times are stored in UTC and displayed in the viewer's timezone in 12-hour Arabic format.
10. Existing Noor endpoints, contracts and tests are unchanged; the feature can be switched off without losing payment events.
