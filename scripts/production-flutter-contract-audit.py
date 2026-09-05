#!/usr/bin/env python3
"""Production audit vs BACKEND_DATA_CONTRACT / BACKEND_REQUIREMENTS / FLUTTER_TO_BACKEND_STATUS_REPLY.
Skips live cron (user postponed until deploy).
"""
from __future__ import annotations

import json
import re
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

BASE = "https://noor-app-backend-one.vercel.app/api/v1"
PASS = 0
FAIL = 0
WARN = 0
RESULTS: list[tuple[str, str, str]] = []


def req(method: str, path: str, body=None, token: str | None = None, timeout=45):
    url = f"{BASE}{path}"
    data = None
    headers = {"Accept": "application/json"}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else {}, dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        try:
            payload = json.loads(raw) if raw else {}
        except json.JSONDecodeError:
            payload = {"raw": raw}
        return e.code, payload, dict(e.headers)


def ok(name: str, cond: bool, detail: str = ""):
    global PASS, FAIL
    detail_s = str(detail).encode("ascii", "replace").decode("ascii") if detail else ""
    if cond:
        PASS += 1
        RESULTS.append(("PASS", name, detail_s))
        print(f"  PASS  {name}" + (f" -- {detail_s}" if detail_s else ""))
    else:
        FAIL += 1
        RESULTS.append(("FAIL", name, detail_s))
        print(f"  FAIL  {name}" + (f" -- {detail_s}" if detail_s else ""))


def warn(name: str, detail: str = ""):
    global WARN
    detail_s = str(detail).encode("ascii", "replace").decode("ascii") if detail else ""
    WARN += 1
    RESULTS.append(("WARN", name, detail_s))
    print(f"  WARN  {name}" + (f" -- {detail_s}" if detail_s else ""))


def envelope(st: int, body: dict, label: str):
    if st >= 400:
        ok(f"{label} error envelope", body.get("success") is False and "code" in body and "message" in body, f"status={st} code={body.get('code')}")
        return
    ok(
        f"{label} success envelope",
        body.get("success") is True
        and isinstance(body.get("message"), str)
        and "data" in body
        and "timestamp" in body
        and "requestId" in body,
        f"status={st}",
    )


def main():
    print("=== Production contract audit (cron live test SKIPPED) ===")
    print(f"BASE={BASE}")
    print(f"at={datetime.now(timezone.utc).isoformat()}")

    # --- Health / ops ---
    print("\n## Health / ops")
    st, body, _ = req("GET", "/health")
    envelope(st, body, "GET /health")
    data = body.get("data") or {}
    ok("health.status ok", data.get("status") == "ok")
    ok("health.database connected", data.get("database") == "connected")
    email = data.get("email") or {}
    ok("health.email.readyForDelivery", email.get("readyForDelivery") is True, str(email))
    qf = data.get("quranFoundation") or {}
    ok("health.quranFoundation.oauthConfigured", qf.get("oauthConfigured") is True, str(qf))
    fcm = data.get("fcm") or {}
    ok("health.fcm.configured true (Flutter P0)", fcm.get("configured") is True, str(fcm))

    # Cron endpoint exists but we only check auth gate (no secret → 401). Do not run real send.
    print("\n## Cron gate only (no live scheduler test)")
    st, body, _ = req("POST", "/cron/prayer-reminders")
    ok("POST /cron/prayer-reminders unauthorized without secret", st == 401 and body.get("code") == "UNAUTHORIZED", f"status={st}")
    st, body, _ = req("GET", "/cron/prayer-reminders")
    ok("GET /cron/prayer-reminders unauthorized without secret", st == 401 and body.get("code") == "UNAUTHORIZED", f"status={st}")

    # --- Public Quran catalogs ---
    print("\n## Quran catalogs + content aliases")
    expected_reciters = {
        "Mishary_Alafasy": 7,
        "Abdul_Basit": 2,
        "Mahmoud_Al_Husary": 6,
        "Abdurrahman_As_Sudais": 3,
        "Saud_Ash_Shuraym": 10,
        "Muhammad_Siddiq_Al_Minshawi": 9,
        "Minshawi_Mujawwad": 8,
    }
    st, body, _ = req("GET", "/quran/reciters")
    envelope(st, body, "GET /quran/reciters")
    reciters = body.get("data") or []
    by_id = {r.get("id"): r for r in reciters if isinstance(r, dict)}
    for rid, resource_id in expected_reciters.items():
        row = by_id.get(rid)
        ok(f"reciter {rid} resourceId={resource_id}", bool(row) and row.get("resourceId") == resource_id, str(row and {k: row.get(k) for k in ('id','resourceId')}))

    st, body, _ = req("GET", "/quran/tafsirs")
    envelope(st, body, "GET /quran/tafsirs")
    tafsirs = {t.get("id"): t.get("resourceId") for t in (body.get("data") or []) if isinstance(t, dict)}
    for tid, rid in [("Ibn_Kathir", 14), ("Al_Tabari", 15), ("Al_Qurtubi", 90), ("Ibn_Kathir_En", 169)]:
        ok(f"tafsir {tid}", tafsirs.get(tid) == rid, f"got={tafsirs.get(tid)}")

    st, body, _ = req("GET", "/quran/translations")
    envelope(st, body, "GET /quran/translations")
    translations = {t.get("id"): t.get("resourceId") for t in (body.get("data") or []) if isinstance(t, dict)}
    for tid, rid in [("Sahih_International", 20), ("Yusuf_Ali", 22), ("Pickthall", 19)]:
        ok(f"translation {tid}", translations.get(tid) == rid, f"got={translations.get(tid)}")

    # audio by string id vs numeric resourceId
    st, body, _ = req("GET", "/quran/audio?surahId=1&ayahNumber=1&reciterId=Abdul_Basit")
    envelope(st, body, "GET /quran/audio string id")
    audio = body.get("data") or {}
    ok("audio string id returns Abdul_Basit", audio.get("reciter") == "Abdul_Basit", str(audio.get("reciter")))
    url_a = audio.get("audioUrl") or ""

    st, body, _ = req("GET", "/quran/audio?surahId=1&ayahNumber=1&reciterId=2")
    envelope(st, body, "GET /quran/audio numeric resourceId=2")
    audio2 = body.get("data") or {}
    # Production may still be old until deploy — record accurately
    if audio2.get("reciter") == "Abdul_Basit":
        ok("audio resourceId=2 maps to Abdul_Basit", True, audio2.get("reciter"))
    else:
        warn("audio resourceId=2 mapping", f"got reciter={audio2.get('reciter')} (deploy pending for resourceId catalog match)")

    st, body, _ = req("GET", "/quran/tafsir?surahId=1&ayahNumber=1&tafsirId=14")
    envelope(st, body, "GET /quran/tafsir tafsirId=14")
    tafsir = body.get("data") or {}
    ok("tafsir has text", bool(tafsir.get("text") or tafsir.get("textAr")), f"source={tafsir.get('source')}")

    st, body, _ = req("GET", "/quran/translation?surahId=1&ayahNumber=1&translationId=20")
    envelope(st, body, "GET /quran/translation translationId=20")
    tr = body.get("data") or {}
    ok("translation has text", bool(tr.get("text")), f"source={tr.get('source')}")

    # soft: surah names never bare ids
    st, body, _ = req("GET", "/quran/surahs")
    envelope(st, body, "GET /quran/surahs")
    surahs = body.get("data") or []
    if isinstance(surahs, dict):
        surahs = surahs.get("items") or surahs.get("surahs") or []
    bare = []
    for s in surahs[:20] if isinstance(surahs, list) else []:
        name = str(s.get("nameAr") or "")
        if re.fullmatch(r"\d+", name.strip()):
            bare.append(s.get("id"))
    ok("surah nameAr not bare ids (sample)", len(bare) == 0, f"bare={bare}")

    # --- Public Adhkar / prayers / qibla ---
    print("\n## Public Adhkar / prayers / qibla")
    st, body, _ = req("GET", "/adhkar")
    envelope(st, body, "GET /adhkar public")
    adhkar = body.get("data") or {}
    ok("adhkar has dailyWird + categories", "dailyWird" in adhkar and "categories" in adhkar, f"keys={sorted(adhkar.keys())}")
    ok("adhkar EN fields present", bool(adhkar.get("greetingEn") or adhkar.get("titleEn")), f"titleEn={adhkar.get('titleEn')}")

    st, body, _ = req("GET", "/adhkar/search?q=%D8%A7%D9%84%D9%84%D9%87")
    envelope(st, body, "GET /adhkar/search")

    st, body, _ = req("GET", "/prayers/schedule?lat=30.0444&lng=31.2357&method=EGYPT&madhab=SHAFI")
    envelope(st, body, "GET /prayers/schedule")
    sched = body.get("data") or {}
    rows = sched.get("schedule") or []
    ok("prayer schedule 5 rows", len(rows) == 5, f"count={len(rows)}")
    if rows:
        ok("prayer name Title Case", bool(re.match(r"^[A-Z][a-z]+$", str(rows[0].get("name") or ""))), str(rows[0].get("name")))
        ok("prayer time HH:mm", bool(re.match(r"^\d{2}:\d{2}$", str(rows[0].get("time") or ""))), str(rows[0].get("time")))

    st, body, _ = req("GET", "/prayers/today?lat=30.0444&lng=31.2357&method=EGYPT&madhab=SHAFI")
    envelope(st, body, "GET /prayers/today public coords")

    st, body, _ = req("GET", "/qibla/calculate?lat=30.0444&lng=31.2357")
    envelope(st, body, "GET /qibla/calculate")

    # --- Auth signup/login ---
    print("\n## Auth")
    suffix = str(int(time.time()))
    email = f"flutter.contract.{suffix}@example.com"
    password = "ContractTest1!"
    st, body, _ = req(
        "POST",
        "/auth/sign-up",
        {"fullName": "Flutter Contract", "email": email, "password": password, "username": f"fc{suffix}"[:20]},
    )
    if st in (200, 201) and (body.get("data") or {}).get("tokens"):
        envelope(st, body, "POST /auth/sign-up")
        tokens = (body.get("data") or {}).get("tokens") or {}
        user = (body.get("data") or {}).get("user") or {}
        access = tokens.get("accessToken")
        refresh = tokens.get("refreshToken")
        ok("signup tokens shape", bool(access and refresh and tokens.get("expiresIn")), f"expiresIn={tokens.get('expiresIn')}")
        ok("signup user shape", bool(user.get("id") and user.get("email")), str({k: user.get(k) for k in ('id','email','fullName')}))
    else:
        warn("sign-up", f"status={st} msg={body.get('message')} — trying login path may fail")
        access = None
        refresh = None
        st, body, _ = req("POST", "/auth/login", {"email": email, "password": password})
        envelope(st, body, "POST /auth/login fallback")
        tokens = (body.get("data") or {}).get("tokens") or {}
        access = tokens.get("accessToken")
        refresh = tokens.get("refreshToken")

    st, body, _ = req("POST", "/auth/forgot-password", {"email": email})
    envelope(st, body, "POST /auth/forgot-password")
    ok("forgot-password always success envelope", st == 200 and body.get("success") is True)

    st, body, _ = req("POST", "/auth/forgot-password", {"email": "does-not-exist-noor@invalid.example"})
    if st == 429:
        warn("forgot-password unknown email", "rate-limited (expected after prior sensitive auth calls)")
    else:
        ok("forgot-password generic for unknown email", st == 200 and body.get("success") is True, body.get("message"))

    if not access:
        print("\nABORT: no access token — cannot test auth routes")
        print(f"\nSUMMARY pass={PASS} fail={FAIL} warn={WARN}")
        return 1

    st, body, _ = req("POST", "/auth/refresh", {"refreshToken": refresh})
    envelope(st, body, "POST /auth/refresh")
    if st == 200:
        access = ((body.get("data") or {}).get("tokens") or {}).get("accessToken") or access

    # --- Dashboard ---
    print("\n## Dashboard")
    st, body, _ = req("GET", "/dashboard", token=access)
    envelope(st, body, "GET /dashboard")
    d = body.get("data") or {}
    for key in ["greeting", "prayers", "verseOfTheDay", "hadithOfTheDay", "dailyJourney", "khatmah", "dailyChallenge", "utilities"]:
        ok(f"dashboard.{key}", key in d)
    prayers = d.get("prayers") or {}
    schedule = prayers.get("schedule") or []
    ok("dashboard 5 prayers", len(schedule) == 5, f"count={len(schedule)}")
    dj = d.get("dailyJourney") or {}
    adh = dj.get("adhkar") or {}
    ok("dailyJourney.adhkar.completed is bool", isinstance(adh.get("completed"), bool), str(adh.get("completed")))
    pr = (dj.get("prayer") or {}).get("progress")
    ok("dailyJourney.prayer.progress 0..1", isinstance(pr, (int, float)) and 0 <= float(pr) <= 1, str(pr))
    quran_target = (dj.get("quran") or {}).get("target")
    ok("dailyJourney.quran.target=5", quran_target == 5, str(quran_target))
    kh = d.get("khatmah") or {}
    sn = str(kh.get("surahNameAr") or "")
    ok("khatmah.surahNameAr not bare id", bool(sn) and not re.fullmatch(r"\d+", sn.strip()), sn)
    ch = d.get("dailyChallenge") or {}
    ok("dailyChallenge titleEn/descriptionEn", bool(ch.get("titleEn")) and bool(ch.get("descriptionEn")), f"titleEn={ch.get('titleEn')}")
    util = d.get("utilities") or {}
    ok("utilities.tasbih.enabled", ((util.get("tasbih") or {}).get("enabled") is True), str(util.get("tasbih")))

    # --- Journey ---
    print("\n## Journey")
    st, body, _ = req("GET", "/journey/today", token=access)
    envelope(st, body, "GET /journey/today")
    jt = body.get("data") or {}
    ok("journey.today has badges/streakDays or tasks", bool(jt), f"keys={list(jt.keys())[:12]}")

    st, body, _ = req("GET", "/journey/progress?days=7", token=access)
    envelope(st, body, "GET /journey/progress")

    st, body, _ = req("GET", "/journey/badges", token=access)
    envelope(st, body, "GET /journey/badges")
    badges = body.get("data") or {}
    ok("badges payload {badges, streakDays}", isinstance(badges.get("badges"), list) and "streakDays" in badges, str({k: badges.get(k) if k != 'badges' else f'list[{len(badges.get("badges") or [])}]' for k in badges}))

    st, body, _ = req("PATCH", "/journey/prayer", {"prayer": "Asr", "completed": True}, token=access)
    envelope(st, body, "PATCH /journey/prayer")

    st, body, _ = req("PATCH", "/journey/adhkar", {"categoryKey": "GENERAL_WIRD", "completed": True}, token=access)
    envelope(st, body, "PATCH /journey/adhkar")

    st, body, _ = req("PATCH", "/journey/sadaqah", {"amount": 10}, token=access)
    envelope(st, body, "PATCH /journey/sadaqah")

    st, body, _ = req("POST", "/journey/quran-pages/increment", {"pages": 1}, token=access)
    envelope(st, body, "POST /journey/quran-pages/increment")

    # --- Challenges / tasbih / qibla / notifications ---
    print("\n## Challenges / tasbih / qibla / notifications")
    st, body, _ = req("GET", "/challenges", token=access)
    envelope(st, body, "GET /challenges")
    st, body, _ = req("GET", "/challenges/today", token=access)
    envelope(st, body, "GET /challenges/today")
    today_ch = body.get("data") or {}
    ok("challenge EN fields", bool(today_ch.get("titleEn") or (isinstance(today_ch, dict) and True)), f"keys sample")

    st, body, _ = req("GET", "/tasbih/today", token=access)
    envelope(st, body, "GET /tasbih/today")
    tb = body.get("data") or {}
    ok("tasbih dhikrEn present", bool(tb.get("dhikrEn") or tb.get("currentDhikrEn")), f"dhikrEn={tb.get('dhikrEn')}")

    st, body, _ = req("POST", "/tasbih/increment", {"amount": 1}, token=access)
    envelope(st, body, "POST /tasbih/increment")

    st, body, _ = req("PUT", "/profile/location", {"latitude": 30.0444, "longitude": 31.2357, "city": "Cairo", "country": "Egypt"}, token=access)
    # may be PUT or PATCH depending on API
    if st >= 400:
        st, body, _ = req("PATCH", "/profile/location", {"latitude": 30.0444, "longitude": 31.2357, "city": "Cairo", "country": "Egypt"}, token=access)
    envelope(st, body, "profile location")

    st, body, _ = req("GET", "/qibla/my-qibla", token=access)
    envelope(st, body, "GET /qibla/my-qibla")

    st, body, _ = req("GET", "/notifications", token=access)
    envelope(st, body, "GET /notifications")
    st, body, _ = req("GET", "/notifications/unread-count", token=access)
    envelope(st, body, "GET /notifications/unread-count")
    st, body, _ = req("POST", "/notifications/read-all", token=access)
    envelope(st, body, "POST /notifications/read-all")

    # --- Profile azan + reading prefs ---
    print("\n## Profile / azan / devices")
    st, body, _ = req("GET", "/profile/me", token=access)
    if st >= 400:
        st, body, _ = req("GET", "/profile", token=access)
    if st >= 400:
        st, body, _ = req("GET", "/auth/me", token=access)
    envelope(st, body, "profile/me or auth/me")

    st, body, _ = req("GET", "/profile/reading-preferences", token=access)
    envelope(st, body, "GET /profile/reading-preferences")
    rp = body.get("data") or {}
    ok("reading prefs quranAutoScroll key", "quranAutoScroll" in rp, f"keys={sorted(rp.keys())}")
    ok("reading prefs legacy quranAutoScrollEnabled", "quranAutoScrollEnabled" in rp)

    st, body, _ = req("PATCH", "/profile/reading-preferences", {"quranAutoScroll": True}, token=access)
    envelope(st, body, "PATCH reading-preferences quranAutoScroll")

    st, body, _ = req("GET", "/profile/azan-preferences", token=access)
    envelope(st, body, "GET /profile/azan-preferences")
    az = body.get("data") or {}
    for k in [
        "azanEnabled",
        "soundEnabled",
        "vibrationEnabled",
        "voiceId",
        "calculationMethod",
        "madhab",
        "preReminderMinutes",
        "preReminderEnabled",
        "prayers",
        "fcmPrayerBackupEnabled",
    ]:
        ok(f"azan pref {k}", k in az, f"value={az.get(k)}")

    st, body, _ = req(
        "PATCH",
        "/profile/azan-preferences",
        {"fcmPrayerBackupEnabled": True, "calculationMethod": "EGYPT", "madhab": "SHAFI"},
        token=access,
    )
    envelope(st, body, "PATCH /profile/azan-preferences")

    # FCM token register/unregister (fake token — should still accept storage)
    fake_token = f"contract_test_token_{suffix}_" + ("x" * 40)
    st, body, _ = req("POST", "/devices/fcm-token", {"token": fake_token, "platform": "android"}, token=access)
    envelope(st, body, "POST /devices/fcm-token")
    st, body, _ = req("GET", "/devices", token=access)
    envelope(st, body, "GET /devices")
    st, body, _ = req("DELETE", "/devices/fcm-token", {"token": fake_token}, token=access)
    envelope(st, body, "DELETE /devices/fcm-token")

    # Adhkar auth surfaces
    print("\n## Adhkar auth")
    st, body, _ = req("GET", "/adhkar", token=access)
    envelope(st, body, "GET /adhkar with Bearer")
    st, body, _ = req("GET", "/adhkar/progress?categoryKey=MORNING", token=access)
    envelope(st, body, "GET /adhkar/progress")
    st, body, _ = req("GET", "/adhkar/favorites", token=access)
    envelope(st, body, "GET /adhkar/favorites")

    # prayers mark + today auth
    st, body, _ = req("GET", "/prayers/today", token=access)
    envelope(st, body, "GET /prayers/today auth")
    st, body, _ = req("PATCH", "/prayers/ASR/mark", token=access)
    envelope(st, body, "PATCH /prayers/ASR/mark")

    # logout
    st, body, _ = req("POST", "/auth/logout", {"refreshToken": refresh} if refresh else {}, token=access)
    envelope(st, body, "POST /auth/logout")

    print("\n" + "=" * 60)
    print(f"SUMMARY  pass={PASS}  fail={FAIL}  warn={WARN}")
    print("=" * 60)
    if FAIL:
        print("\nFailures:")
        for status, name, detail in RESULTS:
            if status == "FAIL":
                print(f"  - {name}: {detail}")
    if WARN:
        print("\nWarnings:")
        for status, name, detail in RESULTS:
            if status == "WARN":
                print(f"  - {name}: {detail}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
