# Backend → Flutter — stop polling `GET /ayah` (2026-09-27)

**Priority:** P0 before Play release  
**Endpoint:** `GET /api/v1/ayah` (no contract change)

---

## 1. What production logs show

One signed-in Android user (Railway logs, 2026-09-27 02:14–02:21 UTC):

| Metric | Value |
|--------|-------|
| `GET /ayah` requests | **182 in ~6 minutes** (about **1 per second**) |
| Distinct `X-Noor-App-Open-Id` values | **1** (same app open) |
| Distinct ayahs returned | **1** (the same ayah every time) |
| Server time per call | ~600 ms (4 DB queries) |

Every call after the first returned an identical payload. With 1,000 users that is ~3.6 million useless requests per hour and will exhaust the database.

---

## 2. Contract reminder (unchanged)

- Generate `X-Noor-App-Open-Id` (UUID v4) **once per cold start** (you already do this in `lib/core/session/noor_app_open_id.dart`).
- Same header value → backend always returns the **same ayah**. It never changes during the process lifetime.
- New header value (next cold start) → backend may pick a new ayah and keeps the old one in `GET /ayah/history`.

So there is **nothing new to fetch** by calling it again with the same header.

---

## 3. Required change

Call `GET /ayah` **only** in these cases:

| Trigger | Call? |
|---------|-------|
| Cold start, after login / session restore | **Yes, once** |
| Pull-to-refresh on Home | Yes (optional) |
| Retry after a failed call (network / 5xx) | Yes, with backoff (2s, 5s, 15s, then stop) |
| Timer / periodic tick / every second | **No** |
| Every Home rebuild, `build()`, `BlocBuilder`, tab switch | **No** — read from memory |
| Home widget refresh (`NoorWidgetSync`) | **No** — use `noor:ayah:latest` cache |
| App resume from background (same process) | **No** — same `X-Noor-App-Open-Id`, same ayah |
| Countdown / prayer timer ticks | **No** |

### Suggested implementation

```dart
class AyahRepository {
  AyahModel? _current;
  Future<AyahModel>? _inFlight;

  Future<AyahModel> getCurrent({bool force = false}) {
    if (!force && _current != null) return Future.value(_current!);
    return _inFlight ??= _api.getAyah(openId: kNoorAppOpenId).then((a) {
      _current = a;
      _cache.saveLatest(a);          // noor:ayah:latest for widgets/offline
      return a;
    }).whenComplete(() => _inFlight = null);
  }

  void clear() => _current = null;    // on logout / account delete
}
```

- `_inFlight` also stops two widgets from firing parallel requests at startup.
- Pass `force: true` only from pull-to-refresh.

### Where to look

Search the Flutter project for anything that calls the ayah API from:

- `Timer.periodic` / `Stream.periodic`
- a ticker used for the prayer countdown on Home
- `initState` / `build` of a widget that rebuilds every second
- `NoorWidgetSync` refresh loop

The 1-per-second rate strongly suggests the Home prayer countdown timer is triggering the ayah fetch.

---

## 4. How to verify

1. Run the app, stay on Home for 2 minutes.
2. Backend logs (or debug `PrettyDioLogger`) should show **1** `GET /ayah`, not ~120.
3. Background the app and resume: still no new `GET /ayah`.
4. Kill and reopen the app: exactly **1** new `GET /ayah` with a **new** `X-Noor-App-Open-Id`.

Tell Backend when it ships and we will confirm from production logs.

---

## 5. Related backend fix (already done, no Flutter change)

Two `GET /ayah` calls arriving at the same moment for a new app open used to return `409 CONFLICT` once (seen in logs 02:18:44). Backend now returns the same ayah to both. You do not need to handle `409` on this endpoint.
