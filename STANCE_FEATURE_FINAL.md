# موقفك إيه؟ — Flutter Contract (2026)

**Status:** Backend ready — consecutive ethical situations + شرعي reveal.  
**Base:** `https://noorapp-backend-production.up.railway.app/api/v1`

## Screen mapping

| UI | API |
|----|-----|
| بطاقة موقف اليوم | `GET /stances/today` → `data.situation` |
| 3 خيارات A/B/C | `situation.options[]` |
| الرأي الشرعي والأصح | بعد الإجابة: `POST /stances/:id/answer` → `data.reveal` |
| الموقف التالي | `GET /stances/next?afterId={id}` أو استخدم `situation.nextId` |

## Endpoints

### 1) Today
```http
GET /api/v1/stances/today
Authorization: Bearer <optional>
```

### 2) Answer (shows green card)
```http
POST /api/v1/stances/{id}/answer
Content-Type: application/json

{ "selectedOptionKey": "A" }
```
- Guest OK (returns ruling, **no points**).
- Logged-in: saves answer once + awards `rewardPoints`, then idempotent.

### 3) Next consecutive
```http
GET /api/v1/stances/next?afterId=stance_001
```

### 4) Catalog (optional)
```http
GET /api/v1/stances/catalog
```

## Notes
- Catalog size: **60** situations (cycles by dayOfYear for "today"; next wraps 60→1).
- Before answer: response **never** includes `correctOptionKey` / `rulingAr`.
- After answer: `reveal.rulingAr` + `rulingTitleAr` = `الرأي الشرعي والأصح`.
- CTA label: `nextCtaAr` = `الموقف التالي`.

## Flutter flow
1. Open screen → `GET /stances/today`
2. User taps option → `POST /stances/{id}/answer`
3. Show green card from `reveal`
4. Tap التالي → `GET /stances/next?afterId={id}`
