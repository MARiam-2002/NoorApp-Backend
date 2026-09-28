# Noor AI — Flutter Integration Spec (2026–2027)

> **Audience:** the Flutter team and the Cursor agent working in the Flutter repository.
> **Goal:** build the Noor AI assistant UI and networking once, correctly, so it lights up automatically as the backend enables each feature.
> **Backend base URL:** `https://noorapp-backend-production.up.railway.app/api/v1`
> **Source of truth:** this file. Do **not** invent endpoints, fields or behaviours that are not written here.

---

## 0. Instructions for the Cursor agent (read first)

1. Implement everything in this file inside a new feature module `lib/features/ai/`, following the app's **existing** architecture, state-management library, Dio client, auth interceptor, theme, fonts, localization and routing. Do not add a new state-management library.
2. The whole feature is **gated by the backend** (`GET /ai/status`). Nothing AI-related may be visible unless the backend says so (§3).
3. Endpoints marked **LIVE** exist now. Endpoints marked **PLANNED** are the agreed draft contract — build the code, keep it behind the gate, and parse tolerantly (§5.8). They will be switched on server-side without an app update.
4. **Never** display Quran, hadith or tafsir text that comes from the model's streamed text. Religious text is shown **only** from `citation` objects built by the backend (§6.4).
5. Never send AI question/answer text to Firebase Analytics, Crashlytics, logs or any third-party SDK (§9).
6. Do not add Socket.io, WebSocket, Firebase Realtime DB/Firestore listeners, gRPC or any SSE package. Use Dio streaming + the small parser in §5.3.
7. Do not ship any mock/sample religious answers. A debug-only fake transport is allowed with **non-religious placeholder text only** and must be excluded from release builds (`kDebugMode`).

---

## 1. Status of each backend capability

| Capability | Endpoint | Status | Backend phase |
|---|---|---|---|
| Feature flag + limits | `GET /ai/status` | **LIVE** (returns 503 `AI_DISABLED` today) | 1 ✅ |
| Quran discovery (deterministic, no LLM) | `POST /ai/quran-discovery` | **IMPLEMENTED** (behind the flag: 503 `AI_DISABLED` until the server enables AI) — contract in §5.6.1 | 2 ✅ |
| Chat answer (JSON) | `POST /ai/chat` with `stream:false` | PLANNED | 6 |
| Conversations list / detail / delete | `GET/DELETE /ai/conversations…` | PLANNED | 7 |
| Daily usage | `GET /ai/usage` | PLANNED | 7 |
| Streaming chat (SSE) | `POST /ai/chat` with `stream:true` | PLANNED | 8 |

`GET /ai/status → data.features` tells the app which of these are on (§3). Each UI piece checks its own flag.

---

## 2. Transport decision: SSE over HTTPS (not Socket.io / WebSocket)

**Use Server-Sent Events (SSE) on a normal authenticated `POST` request, read with Dio `ResponseType.stream`.**

| Option | Verdict | Why |
|---|---|---|
| **SSE over POST (chosen)** | ✅ | One question → one streamed answer (server→client only). Same Dio client, same `Authorization: Bearer` header, same refresh-token interceptor, same error envelope. Works through Railway/CDN proxies. No sticky sessions, no reconnection protocol, nothing to keep open when the chat screen is closed. This is how major AI chat APIs stream in 2026. |
| JSON only (`stream:false`) | ✅ fallback | Used for quran-discovery and whenever `features.streaming` is `false`. |
| Socket.io / WebSocket | ❌ | Bidirectional long-lived socket is unnecessary, needs its own auth/reconnect/heartbeat logic, breaks the REST error envelope, and the backend does not and will not expose one. The existing contract already forbids sockets for the rest of the app. |
| Browser `EventSource` / SSE packages | ❌ | `EventSource` is GET-only and cannot send the Bearer header or a JSON body; third-party SSE packages are unnecessary. |
| Firebase listeners / polling | ❌ | Extra cost and latency; answers are generated per request. |

---

## 3. Feature gate — `GET /ai/status` (LIVE)

### 3.1 When to call
- Only when the user is **logged in** (guests never see AI; show a sign-in prompt if they tap an AI entry point).
- On app start after auth is restored, then cache for **6 hours**; re-check on app resume if the cache is older than 6 hours, and after login/logout.
- Never poll in a loop. Never retry automatically on 503.

### 3.2 Responses

**Disabled (current production behaviour):** `503`
```json
{
  "success": false,
  "message": "Noor AI is not available yet",
  "code": "AI_DISABLED",
  "blame": "FEATURE_DISABLED",
  "nextCheck": "Feature is switched off on the server; hide its entry point in the app.",
  "timestamp": "2026-09-28T10:30:00.000Z",
  "requestId": "…"
}
```
→ Treat as `AiAvailability.disabled`. **Silent**: no toast, no error screen, no Crashlytics non-fatal. Hide every AI entry point.

**Enabled:** `200` (requires Bearer token; `401` follows the app's normal refresh/re-login flow)
```json
{
  "success": true,
  "message": "Noor AI status retrieved successfully",
  "data": {
    "enabled": true,
    "provider": "openai",
    "configured": true,
    "features": { "chat": true, "streaming": true, "quranDiscovery": true, "conversations": true },
    "limits": { "maxMessageLength": 1500, "dailyMessageLimit": 20, "maxStreamSeconds": 120 }
  },
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```

### 3.3 Gate rules
| Condition | UI |
|---|---|
| 503 `AI_DISABLED`, network error, or not logged in | All AI entry points hidden |
| `enabled && configured && features.chat` | Show chat entry points |
| `enabled && features.quranDiscovery` | Show "بحث في الآيات" inside the AI screen / Quran search (does **not** require `configured` — no AI provider is involved) |
| `features.streaming` | Use SSE; otherwise call chat with `stream:false` |
| `features.conversations` | Show history list + delete actions |
| Unknown extra fields/features | Ignore |

`provider` is informational only — never show it to users and never branch logic on it.

---

## 4. Screens & UX (Arabic-first, RTL)

### 4.1 Entry points (only when the gate allows)
1. **Home/dashboard card** — "اسأل نور" with a short subtitle ("إجابات من القرآن والمصادر المعتمدة"). Opens a new chat.
2. **Quran reader** — ayah long-press / action sheet item "اسأل عن هذه الآية". Opens chat with `context: { surahId, ayahNumber }` and shows the ayah as a context chip above the composer.
3. **Tafsir screen** — button "اسأل عن التفسير" with the same context.
4. **Quran search** — when `features.quranDiscovery`, add a tab/toggle "بحث في الآيات" that calls quran-discovery (§5.6.1). Today it matches words (spelling-tolerant, Uthmani-aware), not meaning; do not label it "بحث بالمعنى". Meaning-based results will be added later behind the same endpoint without an app change.

### 4.2 First-use consent sheet (once per install + account)
Bottom sheet before the first question:
- "أسئلتك تُرسل إلى مزوّد خدمة الذكاء الاصطناعي لتوليد الإجابة، وتُحفظ في سجل محادثاتك ويمكنك حذفها في أي وقت."
- "لا تكتب بيانات شخصية حساسة."
- "الإجابات معرفية من مصادر معتمدة وليست فتوى."
- Link to the privacy policy: `https://noorapp-backend-production.up.railway.app/privacy`
- Buttons: "موافق" (store acceptance locally) / "لاحقاً".

### 4.3 Chat screen layout
- **App bar:** title "نور"، actions: history (if `features.conversations`), new chat.
- **Empty state:** short intro + 4 suggestion chips of *questions only* (e.g. "ما معنى آية الكرسي؟", "آيات عن الصبر", "ما فضل سورة الملك؟", "اشرح لي سورة الفاتحة"). Tapping fills and sends.
- **Message list:** user bubbles (start-aligned in RTL = right), assistant bubbles full-width cards.
- **Assistant card contents (top → bottom):**
  1. Stage indicator while working: "يبحث في المصادر…" → "يتحقق من الأدلة…" → "يكتب الإجابة…" (from `status` events).
  2. Answer text (selectable, plain text; streaming caret while `delta`s arrive). Citation markers `[1]` render as small tappable superscript chips.
  3. **Sources section** "المصادر": one card per citation (§6.4). Tapping a marker scrolls/highlights its card.
  4. Disclaimer line (small, muted): value of `disclaimer` from the backend.
  5. Actions row: copy (answer + sources as text), share, 👍 / 👎 (when feedback ships), regenerate is **not** offered.
- **Composer:** multiline field, RTL, character counter shown when > 80% of `limits.maxMessageLength`, hard limit at that value; send button becomes **stop** while streaming.
- **Usage hint** under composer (if usage endpoint is on): "متبقي 17 من 20 سؤالاً اليوم".

### 4.4 Special answer states
| `status` | Presentation |
|---|---|
| `answered` | Normal card with sources |
| `refused_insufficient_evidence` | Neutral info card (book icon), exact backend text, no sources, no retry button. The backend text is: "لا أملك معلومات موثوقة كافية للإجابة عن هذا السؤال من المصادر المعتمدة لدي." |
| `refused_policy` (e.g. `intent: fatwa_redirect`) | Neutral card with the backend text (it points to qualified scholars / official fatwa bodies). Never style as an error. |
| `error` / stream error | Inline error row "تعذّر إكمال الإجابة" + "إعادة المحاولة" (re-sends the same question as a new request) |
| Cancelled by user | Keep partial text greyed with label "تم الإيقاف" |

### 4.5 History screen (`features.conversations`)
- List: title, relative date; infinite scroll (cursor pagination).
- Swipe-to-delete with confirm; overflow "حذف كل المحادثات" with confirm.
- Opening a conversation loads messages from the server (no local message cache).

### 4.6 Quota exceeded
`429 AI_QUOTA_EXCEEDED` → friendly full-width card: "وصلت للحد اليومي من الأسئلة. يتجدد الحد {resetsAt بالتوقيت المحلي}." Disable composer until reset.

### 4.7 Visual & accessibility
- Use the app's theme tokens (colors, radii, typography) and dark mode.
- Quran text in citation cards uses the **same Uthmani font and widget** as the mushaf/reader; ayah number in the app's ayah-end marker style.
- Minimum touch target 48 dp; supports text scaling up to 200% without clipping.
- Screen reader: citation chip label "المصدر 1: البقرة 255"; stage indicator announced politely.
- Subtle animations only (fade/slide 150–250 ms); respect "reduce motion".
- Light haptic on send and on completion.

---

## 5. Networking

### 5.1 Folder structure
```
lib/features/ai/
  data/
    ai_api.dart                 # Dio calls (status, chat JSON, chat stream, conversations, usage, discovery)
    sse_parser.dart             # §5.3
    ai_event_mapper.dart        # SSE event → AiStreamEvent
  domain/
    ai_models.dart              # §5.2
    ai_repository.dart
  presentation/
    ai_gate.dart                # availability provider/controller (§3)
    chat/ ai_chat_screen.dart, ai_chat_controller.dart, widgets/…
    history/ ai_history_screen.dart
    widgets/ citation_card.dart, citation_marker_text.dart, consent_sheet.dart
```

### 5.2 Models (tolerant parsing)
```dart
enum AiAvailability { unknown, disabled, enabled }

class AiLimits {
  final int maxMessageLength, dailyMessageLimit, maxStreamSeconds;
  const AiLimits({this.maxMessageLength = 1500, this.dailyMessageLimit = 20, this.maxStreamSeconds = 120});
  factory AiLimits.fromJson(Map<String, dynamic>? j) => AiLimits(
        maxMessageLength: (j?['maxMessageLength'] as num?)?.toInt() ?? 1500,
        dailyMessageLimit: (j?['dailyMessageLimit'] as num?)?.toInt() ?? 20,
        maxStreamSeconds: (j?['maxStreamSeconds'] as num?)?.toInt() ?? 120,
      );
}

class AiStatus {
  final bool enabled, configured, chat, streaming, quranDiscovery, conversations;
  final AiLimits limits;
  const AiStatus({required this.enabled, required this.configured, required this.chat,
      required this.streaming, required this.quranDiscovery, required this.conversations, required this.limits});
  factory AiStatus.fromJson(Map<String, dynamic> d) {
    final f = (d['features'] as Map?)?.cast<String, dynamic>() ?? const {};
    return AiStatus(
      enabled: d['enabled'] == true,
      configured: d['configured'] == true,
      chat: f['chat'] == true,
      streaming: f['streaming'] == true,
      quranDiscovery: f['quranDiscovery'] == true,
      conversations: f['conversations'] == true,
      limits: AiLimits.fromJson((d['limits'] as Map?)?.cast<String, dynamic>()),
    );
  }
  bool get canChat => enabled && configured && chat;
}

enum AiAnswerStatus { answered, refusedInsufficientEvidence, refusedPolicy, error, unknown }

AiAnswerStatus parseAnswerStatus(String? s) => switch (s) {
      'answered' => AiAnswerStatus.answered,
      'refused_insufficient_evidence' => AiAnswerStatus.refusedInsufficientEvidence,
      'refused_policy' => AiAnswerStatus.refusedPolicy,
      'error' => AiAnswerStatus.error,
      _ => AiAnswerStatus.unknown,
    };

sealed class AiCitation {
  final int citationId;
  final String sourceName;
  final String reference; // display label, e.g. "البقرة: 255"
  const AiCitation(this.citationId, this.sourceName, this.reference);

  factory AiCitation.fromJson(Map<String, dynamic> j) {
    final id = (j['citationId'] as num?)?.toInt() ?? 0;
    final name = j['sourceName'] as String? ?? '';
    final ref = j['reference'] as String? ?? '';
    return switch (j['sourceType']) {
      'quran' => QuranCitation(id, name, ref,
          surahId: (j['surahId'] as num).toInt(),
          ayahNumber: (j['ayahNumber'] as num).toInt(),
          ayahTo: (j['ayahTo'] as num?)?.toInt(),
          text: j['text'] as String? ?? ''),
      'tafsir' => TafsirCitation(id, name, ref,
          sourceId: j['sourceId'] as String? ?? '',
          surahId: (j['surahId'] as num?)?.toInt(),
          ayahNumber: (j['ayahNumber'] as num?)?.toInt(),
          excerpt: j['excerpt'] as String? ?? '',
          attribution: j['attribution'] as String?),
      'hadith' => HadithCitation(id, name, ref,
          collection: j['collection'] as String? ?? '',
          hadithNumber: j['hadithNumber']?.toString() ?? '',
          grade: j['grade'] as String?,
          textAr: j['textAr'] as String? ?? '',
          translation: j['translation'] as String?),
      _ => UnknownCitation(id, name, ref),
    };
  }
}

class QuranCitation extends AiCitation {
  final int surahId, ayahNumber; final int? ayahTo; final String text;
  const QuranCitation(super.id, super.name, super.ref,
      {required this.surahId, required this.ayahNumber, this.ayahTo, required this.text});
}
class TafsirCitation extends AiCitation {
  final String sourceId, excerpt; final int? surahId, ayahNumber; final String? attribution;
  const TafsirCitation(super.id, super.name, super.ref,
      {required this.sourceId, this.surahId, this.ayahNumber, required this.excerpt, this.attribution});
}
class HadithCitation extends AiCitation {
  final String collection, hadithNumber, textAr; final String? grade, translation;
  const HadithCitation(super.id, super.name, super.ref,
      {required this.collection, required this.hadithNumber, this.grade, required this.textAr, this.translation});
}
class UnknownCitation extends AiCitation {
  const UnknownCitation(super.id, super.name, super.ref);
}

sealed class AiStreamEvent {}
class AiMetaEvent extends AiStreamEvent { final String conversationId, messageId; final String? intent;
  AiMetaEvent(this.conversationId, this.messageId, this.intent); }
class AiStageEvent extends AiStreamEvent { final String stage; AiStageEvent(this.stage); } // retrieving | validating | generating
class AiCitationEvent extends AiStreamEvent { final AiCitation citation; AiCitationEvent(this.citation); }
class AiDeltaEvent extends AiStreamEvent { final String text; AiDeltaEvent(this.text); }
class AiDoneEvent extends AiStreamEvent { final AiAnswerStatus status; final List<AiCitation> citations;
  final String? disclaimer; final int? remainingToday;
  AiDoneEvent(this.status, this.citations, this.disclaimer, this.remainingToday); }
class AiErrorEvent extends AiStreamEvent { final String code, message; AiErrorEvent(this.code, this.message); }
```

### 5.3 SSE parser (no package)
```dart
import 'dart:convert';

class SseMessage {
  final String event;
  final String data;
  const SseMessage(this.event, this.data);
}

/// Minimal WHATWG-compatible SSE parser. Comment lines (": ping") are heartbeats and ignored.
Stream<SseMessage> parseSse(Stream<List<int>> bytes) async* {
  var event = 'message';
  final data = StringBuffer();
  var hasData = false;

  await for (final line in bytes.transform(utf8.decoder).transform(const LineSplitter())) {
    if (line.isEmpty) {
      if (hasData) yield SseMessage(event, data.toString());
      event = 'message';
      data.clear();
      hasData = false;
      continue;
    }
    if (line.startsWith(':')) continue;
    final i = line.indexOf(':');
    final field = i == -1 ? line : line.substring(0, i);
    var value = i == -1 ? '' : line.substring(i + 1);
    if (value.startsWith(' ')) value = value.substring(1);
    if (field == 'event') {
      event = value;
    } else if (field == 'data') {
      if (hasData) data.write('\n');
      data.write(value);
      hasData = true;
    }
  }
  if (hasData) yield SseMessage(event, data.toString());
}
```

### 5.4 Event mapping
```dart
AiStreamEvent? mapSse(SseMessage m) {
  final Map<String, dynamic> j;
  try {
    j = (jsonDecode(m.data) as Map).cast<String, dynamic>();
  } catch (_) {
    return null;
  }
  return switch (m.event) {
    'meta' => AiMetaEvent(j['conversationId'] as String, j['messageId'] as String, j['intent'] as String?),
    'status' => AiStageEvent(j['stage'] as String? ?? ''),
    'citation' => AiCitationEvent(AiCitation.fromJson(j)),
    'delta' => AiDeltaEvent(j['text'] as String? ?? ''),
    'done' => AiDoneEvent(
        parseAnswerStatus(j['status'] as String?),
        ((j['citations'] as List?) ?? const [])
            .map((e) => AiCitation.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
        j['disclaimer'] as String?,
        ((j['usage'] as Map?)?['remainingToday'] as num?)?.toInt(),
      ),
    'error' => AiErrorEvent(j['code'] as String? ?? 'UNKNOWN', j['message'] as String? ?? ''),
    _ => null, // unknown events are ignored for forward compatibility
  };
}
```

### 5.5 Chat request (streaming + JSON fallback)
Request body (PLANNED):
```json
{
  "conversationId": null,
  "message": "ما معنى آية الكرسي؟",
  "stream": true,
  "context": { "surahId": 2, "ayahNumber": 255 },
  "preferences": { "language": "ar" }
}
```
- `conversationId`: `null` for a new chat, then reuse the id from `meta` / JSON `data.conversationId`.
- `context`: only when opened from the Quran reader/tafsir.
- Trim the message; block send if empty or longer than `limits.maxMessageLength`.

```dart
class AiApi {
  AiApi(this._dio); // the app's authenticated Dio (base URL + Bearer + refresh interceptor)
  final Dio _dio;

  Stream<AiStreamEvent> chatStream(Map<String, dynamic> body, CancelToken cancel, AiLimits limits) async* {
    final res = await _dio.post<ResponseBody>(
      '/ai/chat',
      data: {...body, 'stream': true},
      cancelToken: cancel,
      options: Options(
        responseType: ResponseType.stream,
        headers: {'Accept': 'text/event-stream'},
        receiveTimeout: const Duration(seconds: 45), // idle timeout; server sends ": ping" every 15 s
        validateStatus: (_) => true,
      ),
    );
    final contentType = res.headers.value(Headers.contentTypeHeader) ?? '';
    if (res.statusCode != 200 || !contentType.contains('text/event-stream')) {
      // Error responses are the normal JSON envelope, delivered as a stream.
      final raw = await utf8.decodeStream(res.data!.stream);
      final env = _tryJson(raw);
      throw AiApiException(res.statusCode ?? 0, env?['code'] as String? ?? 'UNKNOWN',
          env?['message'] as String? ?? '');
    }
    final deadline = DateTime.now().add(Duration(seconds: limits.maxStreamSeconds + 10));
    await for (final m in parseSse(res.data!.stream.cast<List<int>>())) {
      if (DateTime.now().isAfter(deadline)) {
        cancel.cancel('deadline');
        break;
      }
      final e = mapSse(m);
      if (e != null) yield e;
      if (e is AiDoneEvent || e is AiErrorEvent) break;
    }
  }

  Future<Map<String, dynamic>> chatJson(Map<String, dynamic> body, CancelToken cancel) async {
    final res = await _dio.post('/ai/chat', data: {...body, 'stream': false}, cancelToken: cancel);
    return (res.data['data'] as Map).cast<String, dynamic>();
  }

  Map<String, dynamic>? _tryJson(String s) {
    try { return (jsonDecode(s) as Map).cast<String, dynamic>(); } catch (_) { return null; }
  }
}

class AiApiException implements Exception {
  final int statusCode; final String code; final String message;
  AiApiException(this.statusCode, this.code, this.message);
}
```

JSON (`stream:false`) response `data` (PLANNED):
```json
{
  "conversationId": "…", "messageId": "…",
  "status": "answered",
  "intent": "tafsir",
  "answer": "… [1] … [2]",
  "citations": [ { "citationId": 1, "sourceType": "quran", "sourceName": "القرآن الكريم",
                   "reference": "البقرة: 255", "surahId": 2, "ayahNumber": 255, "text": "…" } ],
  "disclaimer": "هذه إجابة معرفية من مصادر معتمدة وليست فتوى.",
  "usage": { "remainingToday": 17 }
}
```

### 5.6 Other endpoints

#### 5.6.1 `POST /ai/quran-discovery` (IMPLEMENTED — behind the flag)
Deterministic: no AI model, no generated text. Requires `Authorization: Bearer` when AI is enabled; returns 503 `AI_DISABLED` (any caller) while disabled.

Request:
```json
{ "query": "البقرة 255", "limit": 10 }
```
- `query`: 1–200 characters after trimming (required).
- `limit`: integer 1–50, default 10. Applies to `search` mode only.

Two modes, chosen by the backend:

| `mode` | When | `results` |
|---|---|---|
| `exact` | The query is a Quran reference: `البقرة 255`, `البقرة:255`, `البقرة 255-257`, `سورة البقرة آية 255`, `2:255`, `2:255-257`, `2 255`, `Al-Baqarah 255`, Arabic-Indic digits (`٢:٢٥٥`), `البقرة 255 إلى 257`, traditional names (`براءة 1`, `بني إسرائيل 1`, `تبارك 1`, `عم 1`) | Exactly the requested ayah or contiguous range (max 50 ayahs, `limit` ignored), mushaf order, `score: 1` |
| `search` | Anything else (`آيات عن الصبر`, `الصلاة`, `ما حكم الربا`) | Ayahs whose words match the topic words, spelling-tolerant (Uthmani vs standard spelling, hamza/alef forms, attached و/ف/ب/ل/ال). Sorted by `score` desc, then shorter ayah, then mushaf order. `score` ∈ (0, 1]: 1 = the exact word, 0.9 / 0.875 = same word with an attached prefix or a standard spelling (بالصبر for الصبر, قال for فقال, الرحمن for ٱلرَّحْمَٰن), 0.85 = same letters without alef, 0.6 = word starting with the term; rare query words weigh more than common ones. Empty array when nothing matches |

Success (`200`, standard envelope):
```json
{
  "success": true,
  "message": "Quran discovery completed successfully",
  "data": {
    "mode": "exact",
    "results": [
      { "surahId": 2, "ayahNumber": 255, "surahNameAr": "البقرة", "text": "ٱللَّهُ لَآ إِلَٰهَ إِلَّا هُوَ …", "page": 42, "juz": 3, "score": 1 }
    ]
  },
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```
- `text` is the canonical stored ayah text — identical to what `/quran/surahs/:id/ayahs` returns (ayah 1 of each surah without the prepended Bismillah). Render it with the mushaf font.
- `page` / `juz` may be `null` (nullable in the database; currently always set).
- Tap a result → open the reader at `surahId` / `ayahNumber`.
- Ruling questions (`ما حكم …`, `هل يجوز …`) only return matching ayahs; the endpoint never produces an answer or ruling. Show them as search results, never as an answer.

Invalid references (`400 VALIDATION_ERROR`, `details.reason`):

| `details.reason` | Example | Suggested message |
|---|---|---|
| `AYAH_OUT_OF_RANGE` | `2:999`, `البقرة 999` | "رقم الآية غير موجود في هذه السورة" |
| `INVALID_SURAH_NUMBER` | `999:1` | "رقم السورة يجب أن يكون من 1 إلى 114" |
| `UNKNOWN_SURAH` | `unknown 255` | "لم نتعرف على اسم السورة" |
| `INVALID_RANGE` | `2:257-255` | "بداية المدى أكبر من نهايته" |
| `RANGE_TOO_LARGE` | `2:1-100` | "الحد الأقصى 50 آية في المرة الواحدة" |

Other `400 VALIDATION_ERROR` (no `details.reason`, Zod `errors[]`): empty/too long `query`, `limit` outside 1–50.

Dart model:
```dart
class QuranDiscoveryItem {
  final int surahId, ayahNumber;
  final String surahNameAr, text;
  final int? page, juz;
  final double score;
  const QuranDiscoveryItem({required this.surahId, required this.ayahNumber, required this.surahNameAr,
      required this.text, this.page, this.juz, required this.score});
  factory QuranDiscoveryItem.fromJson(Map<String, dynamic> j) => QuranDiscoveryItem(
        surahId: (j['surahId'] as num).toInt(),
        ayahNumber: (j['ayahNumber'] as num).toInt(),
        surahNameAr: j['surahNameAr'] as String? ?? '',
        text: j['text'] as String? ?? '',
        page: (j['page'] as num?)?.toInt(),
        juz: (j['juz'] as num?)?.toInt(),
        score: (j['score'] as num?)?.toDouble() ?? 0,
      );
}

class QuranDiscoveryResult {
  final bool isExact;
  final List<QuranDiscoveryItem> results;
  const QuranDiscoveryResult(this.isExact, this.results);
  factory QuranDiscoveryResult.fromJson(Map<String, dynamic> d) => QuranDiscoveryResult(
        d['mode'] == 'exact',
        ((d['results'] as List?) ?? const [])
            .map((e) => QuranDiscoveryItem.fromJson((e as Map).cast<String, dynamic>()))
            .toList(),
      );
}
```
UI: debounce typing by 400 ms, send on submit; for `exact` show a header "المرجع: البقرة 255"; for `search` show the result count and highlight nothing inside the ayah text (never alter Quran text).

#### 5.6.2 Planned endpoints
| Endpoint | Request | Response `data` |
|---|---|---|
| `GET /ai/conversations?cursor&limit` | — | array `[{ id, title, lastMessageAt, createdAt }]`, `meta` = cursor pagination (same shape as other cursor endpoints) |
| `GET /ai/conversations/:id` | — | `{ id, title, messages: [{ id, role, content, status, citations, createdAt }] }` |
| `DELETE /ai/conversations/:id` | — | `204` |
| `DELETE /ai/conversations` | — | `204` (delete all) |
| `GET /ai/usage` | — | `{ day, messagesUsed, dailyLimit, remaining, resetsAt }` |

### 5.7 Error codes
| HTTP | `code` | App behaviour |
|---|---|---|
| 503 | `AI_DISABLED` | Mark gate disabled, hide AI, pop the chat screen silently |
| 503 | `AI_PROVIDER_UNAVAILABLE` | Inline "الخدمة مشغولة حالياً، حاول بعد قليل" + retry |
| 429 | `AI_QUOTA_EXCEEDED` | Quota card (§4.6) |
| 429 | `RATE_LIMIT_EXCEEDED` | "حاول بعد لحظات"; respect `Retry-After` |
| 400 | `VALIDATION_ERROR` | Show message near composer (e.g. too long) |
| 401 | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `INVALID_TOKEN` | Existing refresh → retry once → re-login |
| 404 | `NOT_FOUND` | Conversation deleted: remove from list |
| other / network | — | Inline error + retry |

Always log `requestId` (never message text) when reporting AI errors.

### 5.8 Forward-compatibility rules
- Ignore unknown JSON fields, unknown SSE event types and unknown `features` keys.
- Unknown `status` → render the text as a normal answer without special styling.
- Unknown `sourceType` → generic source card (name + reference, no deep link).
- Never crash on missing optional fields.

---

## 6. Chat controller behaviour

### 6.1 State machine
`idle → sending → streaming → (done | refused | error | cancelled)` per assistant message.

### 6.2 Streaming algorithm
1. Append user message + empty assistant placeholder (stage = `retrieving`).
2. If `status.streaming` → `chatStream`, else `chatJson` and fill the message at once.
3. `AiMetaEvent` → store `conversationId` / `messageId`.
4. `AiStageEvent` → update stage label.
5. `AiCitationEvent` → add/replace by `citationId`.
6. `AiDeltaEvent` → append text; throttle UI rebuilds to ~30 fps (batch deltas every 33 ms).
7. `AiDoneEvent` → final status, replace citations with the final list, set disclaimer, update remaining quota.
8. `AiErrorEvent` / exception → error state (map code per §5.7).

### 6.3 Stop, retry, lifecycle
- **Stop:** `cancelToken.cancel()`; keep partial text with "تم الإيقاف". The backend stops generation when the connection closes.
- **Retry policy:** automatic retry only if the failure happened **before** any `meta` event (connection never established). After `meta`, never auto-retry (avoids double quota use); offer a manual retry.
- **Network drop mid-stream:** show "انقطع الاتصال"; if `features.conversations`, fetch `GET /ai/conversations/:id` to recover the saved final answer.
- **App backgrounded:** let the stream continue; if the OS kills it, recover via the conversation endpoint on resume.
- **Leaving the screen:** cancel the stream.
- One in-flight request per conversation; disable send while streaming.

### 6.4 Rendering religious text (mandatory)
- The streamed/JSON `answer` contains prose plus markers like `[1]`. Parse with `RegExp(r'\[(\d+)\]')` and render each marker as a tappable superscript chip linked to `citationId`.
- **Quran citation card:** reference header ("سورة البقرة · آية 255"), `text` in the mushaf Uthmani font, button "افتح في المصحف" → navigate to the reader at `surahId`/`ayahNumber`; optional "استمع" using the existing ayah audio feature.
- **Tafsir citation card:** source name, reference, `excerpt` (expandable), `attribution` in small text.
- **Hadith citation card:** collection name, hadith number, grade badge (if present), `textAr`, optional translation.
- If the answer text contains a marker with no matching citation, render the marker as plain text (no chip) — never fabricate a source.
- Do not apply Markdown/HTML rendering to AI text (plain selectable text only).

---

## 7. Local storage
- Store only: consent accepted flag, cached `AiStatus` + timestamp, last opened `conversationId`.
- Do **not** store questions/answers locally (history lives on the server so account deletion and "delete all" really delete it).
- Clear all AI local keys on logout and account deletion.

---

## 8. Timeouts summary
| Call | Timeout |
|---|---|
| `GET /ai/status`, usage, conversations | app default (≈15 s) |
| `POST /ai/quran-discovery` | 15 s |
| `POST /ai/chat` JSON | 60 s |
| `POST /ai/chat` stream | connect 15 s, idle 45 s, total `maxStreamSeconds + 10` |

---

## 9. Privacy, analytics, store listing
- Analytics events allowed (no text, no ids of religious content chosen by the user beyond counts): `ai_opened`, `ai_question_sent`, `ai_answer_completed {status, latency_bucket}`, `ai_stopped`, `ai_quota_reached`, `ai_feedback {rating}`.
- Crashlytics: never attach message text, answer text or citations; attach `requestId` only.
- Add "Delete all AI conversations" in Settings → Privacy (when `features.conversations`).
- Before AI is enabled in production the product owner updates the Play Data Safety form and the privacy policy (backend hosts the policy page).

---

## 10. Acceptance checklist
- [ ] With the current backend (503 `AI_DISABLED`) no AI UI is visible anywhere, no error is shown, no Crashlytics event is recorded, and `/ai/status` is called at most once per 6 h per logged-in user.
- [ ] Guests never call `/ai/status`; tapping any AI entry (if reachable) asks them to sign in.
- [ ] With `enabled && configured && chat`, the home card and the Quran reader action appear without an app update.
- [ ] Streaming renders smoothly (≤ 30 rebuilds/s), stop works instantly, partial text preserved.
- [ ] Quran text appears only inside citation cards, in the mushaf font, with a working "open in mushaf" link.
- [ ] Refusal and fatwa-redirect answers use neutral styling with the exact backend text.
- [ ] 429 quota, 503 provider, 401 refresh, and network-drop recovery behave per §5.7 / §6.3.
- [ ] No Socket.io/WebSocket/SSE packages added; Dio stream + `parseSse` only.
- [ ] No AI text in analytics, Crashlytics or local storage.
- [ ] RTL, dark mode, 200% text scale and TalkBack/VoiceOver verified.
- [ ] Unit tests: `parseSse` (multi-line data, comments, missing trailing blank line, split UTF-8 chunks), `mapSse` (unknown events), `AiCitation.fromJson` (unknown type), marker parser (missing citation).

---

## 11. Rollout alignment
| Backend flips | Flutter work needed | Visible result |
|---|---|---|
| Phases 1–2 (now) | Gate + models + parser + screens + quran-discovery client behind the gate | Nothing visible (503) |
| `features.quranDiscovery` | Already built | "بحث في الآيات" appears |
| `features.chat` (JSON) | Already built | Chat works without streaming |
| `features.conversations` | Already built | History + delete appear |
| `features.streaming` | Already built | Answers stream live |

The goal is **one Flutter release** that supports every phase; the backend turns features on gradually.
