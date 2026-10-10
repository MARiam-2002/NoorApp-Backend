# Noor — "التسميع مع معلّم" — Flutter Master Plan

**Status:** PLAN ONLY. The backend endpoints described here do not exist yet; they will be delivered phase by phase (see the backend plan §33). Do not start Flutter implementation before the backend handoff for the matching phase.
**Date:** 2026-10-02
**Audience:** Noor Flutter team
**Backend source of truth:** [`docs/BACKEND_RECITATION_FEATURE_MASTER_PLAN.md`](docs/BACKEND_RECITATION_FEATURE_MASTER_PLAN.md) (API contract §21, error codes §22)

---

## 0. Rules for this feature

1. **The backend owns all business truth:** availability, price, booking state, payment state, Zoom readiness, attendance, evaluation, progress, earnings. Flutter never calculates or decides any of these.
2. **Flutter owns:** presentation, local UI state, short-lived caching, navigation, user input.
3. Follow the app's **existing** architecture: feature module under `lib/features/`, Cubits, GetIt registration, the existing Dio `ApiClient` (envelope unwrap, `ApiException`, token refresh), theme, fonts, l10n (`lib/l10n/app_*.arb`), routing. **Do not add a new state-management library.**
4. **No learning write ever goes through the offline outbox** (`lib/core/storage/offline_outbox.dart`). Bookings, payments, cancellations, evaluations and reviews must either succeed online or show an error. Queuing them could double-book or double-charge.
5. Never send `userId`, `teacherId` (for "me"), price, currency, status or attendance values that the server should decide. The request bodies in this document are the complete allowed fields.
6. Never store Zoom URLs or payment URLs on disk or in logs. Open them and forget them.
7. All times come from the API as UTC ISO strings. Display in the device timezone, 12-hour Arabic (e.g. «٧:٣٠ م»), and use the server-provided display strings where given.
8. Additive only: no existing screen, route or model is renamed or removed. No new bottom tab.

---

## 1. Current Flutter architecture audit

The Flutter source is not in the backend repository. This audit is based on `PAGES_DATA_MAP.md` (page-by-page map of `lib/` with file:line references) and the Flutter handoff documents. **The Flutter team must confirm each item and update this section before implementation.**

| Area | Current state (as documented) | Impact on this feature |
|---|---|---|
| Structure | `lib/features/<feature>/{data,domain,presentation}`, `lib/core/...`, `lib/app/app_router.dart` | New module `lib/features/learning/` with the same layers |
| State management | Cubits (flutter_bloc): `HomeCubit`, `NavCubit`, `JourneyCubit`, `KhatmahCubit`, ... | Learning Cubits |
| DI | GetIt `lib/core/di/service_locator.dart` | Register data sources, repositories, cubits |
| Network | `lib/core/network/api_client.dart`: `_unwrap` throws when `success == false`; `ApiException { message, code, statusCode, details, errors }`; auth header unless `extra['skipAuth']`; 401 → `INVALID_TOKEN` hard logout, otherwise one refresh + replay | Reuse as-is; add learning error-code mapping |
| Base URL | `lib/core/network/api_config.dart` hard-coded, 20 s connect/receive timeouts, no environment switch | Learning write calls should use the Railway base URL (backend decision D16). Needs a second base URL or a per-request base override, plus a staging switch for testing |
| Offline | `OfflineBanner`; repositories fall back to `JsonCacheStore`; failed writes go to the offline outbox | Learning: read cache allowed for lists; **writes excluded from the outbox** |
| Guest mode | `GuestAccess.peekIsGuest()` gates repositories; guests never call `/dashboard` | Guests can browse teachers; must sign in to book |
| Home | `home_page.dart`: `IndexedStack` of 5 tabs (Home, Quran, Azkar, Journey, Account); `home_content.dart` sections; `HomeCubit.loadData()` on creation, `refresh()` on resume | Add a learning card to `home_content.dart`, fed by the additive `learning` section of `/dashboard` |
| Journey | `journey_page.dart`, `JourneyCubit` | Add an entry card |
| Account | `account_page.dart` | Entry points «انضم كمعلم» / «لوحة المعلم» |
| Deep links | Scheme `noorapp://` (e.g. `noorapp://adhkar/{KEY}`); reset-password deep link handled in `app_router.dart` | New `noorapp://learning/...` routes |
| Notifications | FCM with `data.type`, `occurrenceKey` tags; inbox `/notifications` with `deepLink` | Handle `data.type == "learning"` |
| l10n | ARB files, Arabic + English | All new strings in ARB |

---

## 2. Reusable components

- `ApiClient`, `ApiException`, `ServerFailure` / `NetworkFailure` mapping.
- `OfflineBanner`, `JsonCacheStore` (read-only caching for teacher list and my lessons).
- Theme, typography, colours, existing card styles (home section cards), buttons, loaders, empty-state widgets, snackbars.
- Existing 12-hour Arabic time formatting used on prayer screens (`displayAr` style).
- Surah name resolver (`lib/features/quran/domain/surah_name_resolver.dart`) for evaluation ranges (prefer non-empty server `surahNameAr`).
- Existing URL-launching approach (for opening Zoom / payment pages). If none exists, add `url_launcher`.
- FCM handling and the notifications inbox page.

---

## 3. Feature module architecture

```
lib/features/learning/
  data/
    datasources/
      learning_remote_datasource.dart        # student + public endpoints
      teacher_remote_datasource.dart         # teacher endpoints
    models/                                  # DTOs (fromJson only for server-owned fields)
      teacher_summary_model.dart
      teacher_detail_model.dart
      availability_model.dart
      booking_model.dart
      lesson_model.dart
      evaluation_model.dart
      homework_model.dart
      progress_model.dart
      learning_summary_model.dart
      money_model.dart
      teacher_profile_model.dart
      earnings_model.dart
    repositories/
      learning_repository_impl.dart
      teacher_repository_impl.dart
  domain/
    entities/                                # immutable entities used by UI
    repositories/                            # abstract contracts
    usecases/                                # thin, one per action (match app convention)
    learning_error_mapper.dart               # code → localized message + action
  presentation/
    cubits/
      teacher_list_cubit.dart
      teacher_detail_cubit.dart
      availability_cubit.dart
      booking_flow_cubit.dart                # consent → create → pay → verify/poll
      my_lessons_cubit.dart
      lesson_detail_cubit.dart               # includes join + countdown
      evaluation_cubit.dart
      homework_cubit.dart
      progress_cubit.dart
      review_cubit.dart
      learning_summary_cubit.dart            # home card (or reads HomeCubit section)
      teacher_application_cubit.dart
      teacher_dashboard_cubit.dart
      teacher_availability_cubit.dart
      teacher_lessons_cubit.dart
      teacher_evaluation_form_cubit.dart
      teacher_students_cubit.dart
      teacher_earnings_cubit.dart
    pages/                                   # §4
    widgets/                                 # cards, slot grid, countdown, score inputs, quran range picker
  learning_routes.dart
```

Register everything in `service_locator.dart` (lazy singletons for data sources/repositories, factories for Cubits), following existing patterns.

---

## 4. Screens

Each screen lists: data source, states, and actions. Every screen has **loading**, **error (with retry)**, and where relevant **empty** and **offline** states (§9).

### 4.1 Student

| # | Screen | Endpoint(s) | Key content | Actions |
|---|---|---|---|---|
| S1 | Teacher Marketplace `/learning/teachers` | `GET /learning/teachers` (+ `GET /learning/config`) | Cards: photo, name, gender badge, specializations, rating, lessons count, "from" price, next available | Filters (gender, audience, specialization, language, duration, max price), sort, infinite scroll (`page`, `limit=20`) |
| S2 | Teacher Profile `/learning/teachers/:id` | `GET /learning/teachers/:id`, `/reviews` | Bio, qualifications (verified badge), riwayat, languages, price options, reviews preview | Choose duration → S3 |
| S3 | Availability `/learning/teachers/:id/availability` | `GET .../availability?from&days=7&durationMinutes&timezone=<device IANA>` | Day strip (7 days), time chips per day (12-hour Arabic), selected slot summary | Next/prev week (max horizon), pick slot |
| S4 | Booking Confirmation | `GET /learning/config` (policy summary), `POST /learning/consents`, `POST /learning/bookings` | Teacher, date/time (device tz), duration, price (server `display`), cancellation policy summary, optional note (≤500) | Accept consent(s) if required → Create booking → S5 |
| S5 | Payment | `POST /learning/bookings/:id/payment` | Hold countdown from `holdExpiresAt`, amount | "ادفع الآن" opens `paymentUrl` in an in-app browser tab (Custom Tabs / SFSafariViewController); "إلغاء الحجز" |
| S6 | Payment Result `noorapp://learning/bookings/:id/payment-result` | `POST .../payment/verify` then poll `GET /learning/bookings/:id` | Pending spinner → Confirmed / Failed (retry while hold active) / Expired | Go to lesson details; retry payment; rebook |
| S7 | My Lessons `/learning/lessons` | `GET /learning/bookings?scope=upcoming|past` | Tabs upcoming/past; status chips; refund status | Open lesson; pull to refresh |
| S8 | Lesson Details `/learning/lessons/:id` | `GET /learning/lessons/:id` (+ `GET /learning/bookings/:id` for payment/refund info) | Teacher, time, status, countdown, Zoom readiness, cancellation preview, evaluation summary, homework | Join (S9), cancel (with `cancellation-preview`), dispute, review |
| S9 | Join Lesson | `POST /learning/lessons/:id/join` | Button enabled only when the server says `join.available`; "جاري تجهيز رابط الحصة" on `ZOOM_NOT_READY` | Open URL externally (Zoom app or browser); do not cache |
| S10 | Evaluation | `GET /learning/lessons/:id/evaluation` | Overall scores, segments (surah name, ayah range, scores, mistakes), teacher notes, next target, "تم التعديل" badge if `edited` | — |
| S11 | Homework `/learning/homework` | `GET /learning/me/homework` | Assigned/done/reviewed lists | Mark as done (self-report) |
| S12 | Progress `/learning/progress` | `GET /learning/me/progress`, `/me/plans` | Verified ayahs / 6236, per-surah coverage bars, juz coverage, active plan, "needs revision" ranges | — |
| S13 | Recitation History | `GET /learning/me/recitations` | Timeline of lessons with ranges and scores | Open evaluation |
| S14 | Teacher Review | `POST /learning/lessons/:id/review` | Stars 1–5 + optional comment | Submit once |

### 4.2 Teacher

| # | Screen | Endpoint(s) | Key content | Actions |
|---|---|---|---|---|
| T1 | Teacher Application | `POST /learning/teacher-applications` (+ `/learning/uploads/presign` when storage is ready) | Multi-step form: identity, gender, audiences, specializations, bio, languages, country, timezone (prefill from device), riwayat, experience, qualifications (+ documents), proposed prices, teacher agreement | Submit |
| T2 | Application Status | `GET /learning/teacher-applications/me` | Submitted / under review / approved / rejected (+ reason) | Re-apply after rejection |
| T3 | Teacher Profile | `GET/PATCH /learning/teacher/me`, price options | Public profile preview, settings (buffer, notice, horizon, listed toggle), price options + statuses | Edit; propose price |
| T4 | Availability | `GET/PUT /learning/teacher/me/availability`, exceptions | Weekly grid in the teacher's timezone; exceptions list | Save weekly set; add/remove blocked periods |
| T5 | Dashboard (`/learning/teacher`) | `GET /learning/teacher/me`, `/me/bookings?scope=upcoming`, `/me/earnings` | Next lesson, today's lessons, pending evaluations, balance summary | Quick links |
| T6 | Upcoming Lessons | `GET /learning/teacher/me/bookings` | List by day | Open lesson |
| T7 | Lesson Details (teacher) | `GET /learning/lessons/:id` | Student first name, goal note, status, attendance summary (after lesson), evaluation status | Start, cancel (reason required), report student absence |
| T8 | Start Zoom | `POST /learning/lessons/:id/join` (returns `kind: "start"`) | Same window rules | Open externally; never cache |
| T9 | Evaluate Student | `POST /learning/lessons/:id/evaluation` (+ `/corrections`) | Segments editor with Quran range picker (surah → from/to ayah bounded by surah length), scores 0–10, mistakes, notes for student, private notes, next target, homework (0–5) | Submit; correct within window |
| T10 | Homework (teacher) | `PATCH /learning/teacher/me/homework/:id` | Edit instructions/due date | Save |
| T11 | Students | `GET /learning/teacher/me/students` | First name, lessons count, last lesson, active plan | Open progress |
| T12 | Student Progress | `GET /learning/teacher/me/students/:studentKey/progress`, plans endpoints | Same visuals as S12 | Create/update plan |
| T13 | Earnings | `GET /learning/teacher/me/earnings`, `/settlements`, `PUT /payout-account` | Pending / available / paid out, ledger list, settlements, payout account (last 4 only) | Update payout account |

### 4.3 Admin

There is no admin panel today. Admin is **not** part of the Flutter app; it will be a separate internal web tool (backend decision D7).

---

## 5. Navigation, routes & deep links

- **No new bottom tab.** Entry points: Home card, Journey card, Account page («لوحة المعلم» if the user has a teacher profile, otherwise «انضم كمعلم»), notification taps.
- Routes (register in `app_router.dart` / `learning_routes.dart` following the existing routing style):

| Route | Screen | Auth |
|---|---|---|
| `/learning/teachers` | S1 | Guest allowed |
| `/learning/teachers/:id` | S2 | Guest allowed |
| `/learning/teachers/:id/availability` | S3 | Guest allowed (booking requires login) |
| `/learning/book` (args) | S4 | Login |
| `/learning/bookings/:id/pay` | S5 | Login |
| `/learning/bookings/:id/payment-result` | S6 | Login |
| `/learning/lessons` | S7 | Login |
| `/learning/lessons/:id` | S8/T7 (role-aware) | Login |
| `/learning/lessons/:id/evaluation` | S10 | Login |
| `/learning/lessons/:id/evaluate` | T9 | Teacher |
| `/learning/homework`, `/learning/progress`, `/learning/history` | S11–S13 | Login |
| `/learning/teacher`, `/learning/teacher/...` | T1–T13 | Login (teacher screens check status) |

- Deep links (`noorapp://`):
  - `noorapp://learning/teachers/{teacherId}`
  - `noorapp://learning/lessons/{bookingId}`
  - `noorapp://learning/bookings/{bookingId}/payment-result` (payment return page)
  - `noorapp://learning/lessons/{bookingId}/evaluation`
  - `noorapp://learning/homework`
  - `noorapp://learning/teacher/applications`
- A deep link for a guest → login → continue to the target.
- Android intent filters / iOS URL types already cover `noorapp://`; confirm the `learning` host path is routed.

---

## 6. Data models / DTOs (summary)

Field names match the backend contract (§21 of the backend plan). Parse defensively: unknown enum values map to an `unknown` case, never crash.

```dart
class Money { final int amountMinor; final String currency; final String display; }

class TeacherSummary {
  final String id; final String displayNameAr; final String? displayNameEn;
  final String gender;                 // MALE | FEMALE
  final String? avatarUrl;
  final List<String> audiences, specializations, languages, riwayat;
  final String? country; final int? yearsExperience;
  final double? ratingAvg; final int ratingCount, completedLessonsCount;
  final Money priceFrom; final List<int> durations; final DateTime? nextAvailableAt;
}

class Slot { final DateTime startsAt, endsAt; final String timeAr, timeEn; }

enum BookingStatus {
  pendingPayment, confirmed, expired, cancelledByStudent, cancelledByTeacher,
  cancelledByAdmin, completed, noShowStudent, noShowTeacher, disputed, unknown
}

class Booking {
  final String id, code; final BookingStatus status; final String? refundStatus;
  final DateTime startsAt, endsAt; final int durationMinutes;
  final DateTime? holdExpiresAt; final TeacherSummaryLite teacher; final Money price;
  final String zoomStatus; final LessonJoinInfo lesson; final bool hasEvaluation;
}

class LessonJoinInfo { final bool available; final DateTime? opensAt, closesAt; final String zoomStatus; }

class Evaluation {
  final int version; final bool edited; final DateTime submittedAt;
  final Scores overall; final List<EvaluationSegment> segments;
  final String? notesForStudent; final QuranTarget? nextTarget; final List<Homework> homework;
}

class EvaluationSegment {
  final String kind; final int surahId; final String? surahNameAr;
  final int fromAyah, toAyah; final Scores scores; final int mistakesCount;
  final List<Mistake> mistakes;
}

class LearningSummary {               // home card
  final String state;                 // none | upcoming | soon | live | after_lesson
  final NextLesson? nextLesson; final EvaluationBrief? lastEvaluation; final ProgressBrief progress;
}
```

Request DTOs contain **only**:
- `CreateBookingRequest { teacherId, priceOptionId, startsAt, timezone, studentNote? }`
- `PaymentRequest { paymentMethod? }`
- `CancelRequest { reason? }`
- `DisputeRequest { reasonCode, details }`
- `ReviewRequest { rating, comment? }`
- `EvaluationRequest { ... }` (teacher form; see backend §16.1)
- `ConsentRequest { type, version }`

---

## 7. State management

- One Cubit per screen concern (list above). States are sealed classes: `Initial`, `Loading`, `Loaded(data)`, `Empty`, `Failure(errorView)`, plus feature-specific states (e.g. `BookingFlowState.awaitingPayment(holdExpiresAt)`).
- `BookingFlowCubit` drives S4→S6 as a small state machine **mirroring server states only**: `consentRequired → creating → awaitingPayment → openingPayment → verifying → confirmed | failed | expired`. It never moves to `confirmed` without the server saying `CONFIRMED`.
- Polling (S6): after returning from the payment page or deep link, call `payment/verify` once, then `GET /learning/bookings/:id` every 2 s for up to 60 s, then every 10 s with a manual refresh button. Stop on any terminal state.
- Lesson countdown: a ticker in `LessonDetailCubit` based on server `opensAt`; re-fetch the lesson when the countdown reaches zero (do not enable Join locally).
- App resume: refresh My Lessons, the current lesson and the home summary (match `HomeCubit.refresh()` behaviour).

---

## 8. API integration

- All calls through the existing `ApiClient` (auth, refresh, envelope, `ApiException`).
- Guests: only `GET /learning/config`, `/learning/teachers*` with `skipAuth` when no session.
- Timeouts: existing 20 s; the payment creation call may take longer on the server side. Show a progress indicator and treat timeout as "unknown": re-fetch the booking before retrying (the server reuses the open payment attempt).
- Base URL: use the Railway base for learning **write** endpoints (backend decision D16) and add a staging/test base switch for QA builds.
- Error handling: `learning_error_mapper.dart` maps `ApiException.code` → localized message + UI action (table in §10). Unknown codes fall back to the generic message.
- Caching: teacher list and teacher profile cached for 5 minutes in memory; My Lessons cached (`JsonCacheStore`) for offline display with a "قد تكون غير محدّثة" note. Availability, payment, join and evaluation forms are never served from cache.
- No retries on POST except where the server contract guarantees idempotency (booking create, payment create, cancel, evaluation submit), and only after re-fetching state.

---

## 9. Loading, empty, error & offline states

| Screen | Empty state | Offline behaviour |
|---|---|---|
| S1 Marketplace | «لا يوجد معلمون متاحون حاليًا» + reset filters | Cached list with banner; booking disabled |
| S3 Availability | «لا توجد مواعيد متاحة هذا الأسبوع» + next week | Blocked: «تحتاج اتصالًا بالإنترنت لعرض المواعيد» |
| S5/S6 Payment | — | Blocked; if the connection drops after paying, S6 resumes polling when back online |
| S7 My Lessons | «لا توجد حصص بعد» + CTA «استعرض المعلمين» | Cached list, actions disabled |
| S9 Join | — | Blocked with clear message |
| S10 Evaluation | «لم يُرسل المعلم التقييم بعد» | Cached last view allowed |
| S11 Homework | «لا توجد واجبات» | Cached view; "mark done" disabled |
| S12 Progress | «ابدأ أول حصة لتظهر متابعتك هنا» | Cached view |
| T9 Evaluate | — | Form kept in memory (and a local draft is allowed); submit blocked until online. Drafts are not sent automatically |

Loading: skeletons matching the card layouts. Errors: message from the mapper + retry; never show raw server messages or stack traces.

---

## 10. Error UX (codes from backend §22)

| HTTP / code | UX |
|---|---|
| 401 | Existing behaviour (refresh once; `INVALID_TOKEN` → logout) |
| 403 `FORBIDDEN` | «غير مسموح» and navigate back |
| 403 `TEACHER_NOT_APPROVED` | Teacher: open Application Status. Student: «هذا المعلم غير متاح حاليًا» + refresh list |
| 403 `LESSON_NOT_READY` | Show countdown «يفتح الدخول قبل الحصة بـ ١٠ دقائق» |
| 403 `CONSENT_REQUIRED` | Open consent sheet, then retry the same request |
| 404 | «غير موجود» + back |
| 409 `SLOT_ALREADY_BOOKED` | «تم حجز هذا الموعد للتو، اختر موعدًا آخر» + refresh slots |
| 409 `BOOKING_EXPIRED` | «انتهت مهلة الدفع» + «احجز من جديد» |
| 409 `PAYMENT_ALREADY_PROCESSED` | Refetch booking → confirmed screen |
| 409 `REFUND_ALREADY_REQUESTED` | Show refund status |
| 409 `ZOOM_NOT_READY` | «جاري تجهيز رابط الحصة» + automatic retry every 15 s |
| 409 `BOOKING_STATE_CONFLICT` / other 409 | Refetch and re-render |
| 422 (`INVALID_QURAN_RANGE`, `PRICE_OUT_OF_BAND`, ...) | Inline field errors from `errors[]` |
| 429 | «محاولات كثيرة، حاول بعد قليل» (respect `RateLimit-Reset` if present) |
| 500 | Generic error + retry |
| 503 `LEARNING_DISABLED` | Hide entry points; show «الميزة غير متاحة حاليًا» |
| 503 `PAYMENT_PROVIDER_UNAVAILABLE` | «بوابة الدفع غير متاحة حاليًا» + retry |

---

## 11. Payment UX

1. S4 creates the booking (`PENDING_PAYMENT`) and shows the hold countdown (`holdExpiresAt`, e.g. 15 minutes).
2. S5 requests `paymentUrl` and opens it in an **in-app browser tab** (Custom Tabs on Android, SFSafariViewController on iOS) — not a raw WebView, so card entry stays on MyFatoorah's page.
3. MyFatoorah redirects to the **backend** return page, which deep-links to `noorapp://learning/bookings/{id}/payment-result`. If the deep link does not fire (user closes the tab), S5 detects the app resume and moves to S6 anyway.
4. S6 calls `payment/verify` and polls the booking. **The redirect itself proves nothing**; only `status == CONFIRMED` from the API shows success.
5. Failed payment while the hold is active → «لم تتم عملية الدفع» + retry. Expired → rebook.
6. Never show "تم الدفع" based on the URL, a query parameter, or the browser page.
7. Store review: real-time 1-to-1 tutoring paid outside in-app purchase is allowed by Apple guideline 3.1.3(d) (person-to-person services); Google Play policy must be confirmed by Mariam before release (**STORE POLICY REVIEW REQUIRED**).

---

## 12. Zoom UX

- Lesson card states: `scheduled` (countdown) → `join_open` (button active from server `opensAt`) → `live` → `ended` → `evaluated`.
- Tap Join → `POST /join` → open the returned URL with the external application mode (Zoom app if installed, otherwise browser). Show a hint sheet the first time: «سيتم فتح تطبيق Zoom. لو غير مثبت، ثبّته من المتجر».
- Never display, copy, share or store the URL. No "copy link" button.
- `ZOOM_NOT_READY` → preparing state with auto-retry; after 5 minutes show «تواصل مع الدعم» with the booking code.
- Teacher (T8) uses the same button; the server returns a host start URL only to the teacher.
- No recording UI; no in-app chat.

---

## 13. Booking UX

- Slots are shown exactly as returned; no client-side filtering beyond the selected day.
- Times shown in the device timezone (12-hour Arabic). If the device timezone differs from the timezone sent in the availability request, re-request with the device timezone.
- Booking summary always shows: date (Hijri optional), time, duration, teacher, price, and «سياسة الإلغاء» link (server text).
- Double tap protection: disable the button while the request runs; the server is idempotent anyway.
- Cancellation: always call `cancellation-preview` first and show the exact refund amount before confirming.

---

## 14. Evaluation UX

- Student view: overall scores as simple badges (0–10 shown as stars or a bar — design decision), segments with surah names and ayah ranges in Arabic numerals, mistakes grouped by ayah, notes, next target, homework list.
- "تم التعديل" badge when `edited == true` (history is not shown to students).
- Teacher form (T9): Quran range picker bounded by surah length (use the surah catalog; the server validates again). Inline errors from `errors[]`. Local draft kept until submit succeeds. Corrections require a reason.

---

## 15. Progress UX

- Header: verified ayahs and percent of 6236.
- Per-surah list with coverage bars, juz coverage view.
- Active plan card (goal, progress toward goal).
- "Needs revision" ranges if provided by the server.
- All numbers come from the API; Flutter does not merge ranges or compute percentages.

---

## 16. Teacher mode

- Same app. The Account page shows:
  - «انضم كمعلم» when `GET /learning/teacher-applications/me` returns none.
  - «حالة طلبك» while applied/under review/rejected.
  - «لوحة المعلم» when the teacher profile is `APPROVED` (or `SUSPENDED`, showing a suspension banner).
- No role switching toggle: teacher screens are a separate section entered from the Account page or the teacher dashboard; student screens remain available to the same user.
- Teacher-specific notifications deep-link into teacher screens.

---

## 17. Home integration

- Add a "التسميع مع معلّم" card to `home_content.dart`. **No new tab.**
- Data: the `learning` section added (additively) to `GET /dashboard`; if absent (older backend) or for guests, show the static "none" state.

| `learning.state` | Card |
|---|---|
| `none` | Title «التسميع مع معلّم», subtitle «احفظ القرآن مع معلّم متخصص», CTA «استعرض المعلمين» |
| `upcoming` | Teacher avatar + name, date and time of next lesson, CTA «تفاصيل الحصة» |
| `soon` / `live` | Countdown, CTA «دخول الحصة» (opens S8 and uses the join flow) |
| `after_lesson` | Last evaluation summary + progress percent, CTA «عرض التقييم» |

- Journey page: an entry card «تقدمي في الحفظ» linking to S12 (only for users with at least one lesson; otherwise the marketplace CTA).

---

## 18. Notifications

- FCM `data.type == "learning"` with `data.kind`, `data.bookingId`, `data.deepLink`. On tap → navigate by `deepLink`.
- Kinds: `booking_confirmed`, `payment_failed`, `booking_expired`, `lesson_ready`, `reminder_24h`, `reminder_15m`, `lesson_cancelled_by_student`, `lesson_cancelled_by_teacher`, `lesson_cancelled_by_admin`, `no_show_recorded`, `evaluation_ready`, `homework_assigned`, `review_request`, `refund_initiated`, `refund_completed`, `teacher_application_decision`, `price_option_decision`.
- The inbox list may show these with `type: "SYSTEM"` (backend keeps the old contract) — use `payload.kind` / `deepLink` to render a learning icon.
- A notification is never the source of truth: on open, always re-fetch the booking/lesson.
- Do not schedule local reminders for lessons in the MVP (the server sends them); if added later they must be rebuilt from the API on every app start.

---

## 19. RTL, Arabic UX & accessibility

- RTL layouts by default; mirrored icons where meaningful (arrows), not for media/Zoom icons.
- Arabic-Indic digits for times and ayah numbers where the app already uses them (prayer screens use «٧:٥٠ م»).
- Hijri date optional next to Gregorian on booking summaries.
- Gender-appropriate wording where the app supports it (e.g. «المعلم / المعلمة» from teacher gender).
- Accessibility: semantic labels on rating stars, slot chips, countdown, join button; minimum touch target 48 dp; text scaling up to 200% without clipping; colour is never the only status indicator (use icons/text for statuses).

---

## 20. Analytics (if the app has an analytics layer)

Events (no PII, no ids other than opaque booking id hashes): `learning_marketplace_view`, `learning_teacher_view`, `learning_slot_selected`, `learning_booking_created`, `learning_payment_opened`, `learning_payment_confirmed`, `learning_payment_failed`, `learning_join_tapped`, `learning_evaluation_viewed`, `learning_review_submitted`, `learning_teacher_application_submitted`. Never send names, emails, prices tied to users, Zoom/payment URLs, or evaluation content. If no analytics layer exists, skip this section.

---

## 21. Testing

- **Unit:** DTO parsing (unknown enum values, nullables), error mapper, `BookingFlowCubit` transitions (never confirmed without server), polling stop conditions, time formatting in different timezones (Cairo, Riyadh, Casablanca, London DST).
- **Widget:** each screen's loading/empty/error/offline states; join button enabled only from server state; RTL golden tests for key screens.
- **Integration (against the backend test environment):** browse → book → pay (MyFatoorah test card) → confirmed → join; cancel with preview; teacher apply → (admin approves in backend) → availability → evaluation submit.
- **Negative:** slot taken (409), booking expired, payment failed then retried, `ZOOM_NOT_READY`, guest deep link → login → target, airplane mode during payment, app killed during payment (resume → S6).
- **Security checks:** no URLs persisted (inspect SharedPreferences/cache), no learning writes in the offline outbox, logs free of URLs and tokens.

---

## 22. Release checklist

- [ ] Backend phase handoff received for every endpoint used (real responses from the test environment).
- [ ] `lib/features/learning/` follows existing architecture; no new state-management library.
- [ ] Learning writes excluded from the offline outbox.
- [ ] Learning write calls use the agreed base URL; staging switch works.
- [ ] All strings in ARB (Arabic + English); RTL verified.
- [ ] Times displayed from UTC in device timezone, 12-hour Arabic.
- [ ] Payment success shown only after server `CONFIRMED`.
- [ ] Zoom/payment URLs never stored, logged or shareable.
- [ ] Deep links `noorapp://learning/...` work from cold start, background and logged-out state.
- [ ] Notification taps for every learning kind route correctly.
- [ ] Home card handles missing `learning` section (older backend) and guests.
- [ ] Teacher entry points depend on server status only.
- [ ] Empty/error/offline states implemented for every screen.
- [ ] Accessibility pass (labels, scaling, contrast).
- [ ] Privacy labels / Data Safety updated (with Mariam).
- [ ] Store payment-policy review completed (Google Play) — **STORE POLICY REVIEW REQUIRED**.
- [ ] Feature hidden when `GET /learning/config` returns `enabled: false` or `503 LEARNING_DISABLED`.
