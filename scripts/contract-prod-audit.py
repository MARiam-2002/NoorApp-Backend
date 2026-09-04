"""Production contract audit vs Flutter BACKEND_* docs. English-only console."""
import json
import random
import string
import urllib.error
import urllib.parse
import urllib.request

BASE = "https://noor-app-backend-one.vercel.app/api/v1"
results = []


def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body is not None else None
    hdrs = {"Content-Type": "application/json", "Accept": "application/json"}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=45) as resp:
            return resp.status, json.loads(resp.read().decode()), dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            d = json.loads(raw)
        except Exception:
            d = {"raw": raw[:200]}
        return e.code, d, dict(e.headers)


def get(path, token=None):
    return req("GET", path, token=token)


def check(name, cond, detail=""):
    results.append((name, bool(cond), detail))
    flag = "PASS" if cond else "FAIL"
    print(f"{flag} {name} {detail[:200]}")


def main():
    st, d, _ = get("/health")
    check("health_db", st == 200 and (d.get("data") or {}).get("database") == "connected")

    r = urllib.request.Request(
        BASE + "/health",
        method="OPTIONS",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "Authorization,Content-Type",
        },
    )
    try:
        with urllib.request.urlopen(r, timeout=15) as resp:
            origin = resp.headers.get("Access-Control-Allow-Origin")
    except urllib.error.HTTPError as e:
        origin = e.headers.get("Access-Control-Allow-Origin")
    check("cors", origin in ("*", "https://example.com"), str(origin))

    st, d, _ = get("/quran/surahs")
    surahs = d.get("data") or []
    bare = [
        s
        for s in surahs
        if str(s.get("nameAr", "")).isdigit() or str(s.get("nameAr", "")) == str(s.get("id"))
    ]
    check("surah_names", st == 200 and len(surahs) == 114 and not bare, f"n={len(surahs)} bare={len(bare)}")

    for path, label in [
        ("/quran/reciters", "reciters"),
        ("/quran/tafsirs", "tafsirs"),
        ("/quran/translations", "translations"),
    ]:
        st, d, _ = get(path)
        items = d.get("data") if isinstance(d.get("data"), list) else (d.get("data") or {}).get("items") or []
        ok = (
            st == 200
            and items
            and all((i.get("id") or i.get("code")) for i in items)
            and all(i.get("resourceId") for i in items)
        )
        sample = {k: items[0].get(k) for k in ("id", "code", "nameAr", "resourceId")} if items else None
        check(label, ok, f"n={len(items)} sample={sample}")

    st, d, _ = get("/prayers/schedule?lat=30.0444&lng=31.2357&method=EGYPT&madhab=SHAFI")
    sch = (d.get("data") or {}).get("schedule") or []
    check(
        "prayer_schedule",
        st == 200
        and len(sch) == 5
        and [p.get("name") for p in sch] == ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"],
        str([(p.get("name"), p.get("time")) for p in sch]),
    )

    st, d, _ = get("/quran/search?q=" + urllib.parse.quote("الله") + "&limit=5")
    data = d.get("data") or {}
    total = data.get("total") if isinstance(data, dict) else 0
    hits = (
        data.get("results")
        or data.get("ayahs")
        or data.get("items")
        or (data if isinstance(data, list) else [])
    )
    check("quran_search", st == 200 and (total or len(hits)) > 0, f"total={total}")

    st, d, _ = get("/quran/audio?surahId=1&ayahNumber=1&reciterId=Mishary_Alafasy")
    url = (d.get("data") or {}).get("audioUrl") or (d.get("data") or {}).get("url")
    check("audio", st == 200 and str(url).startswith("http"), str(url)[:90])

    st, d, _ = get("/quran/tafsir?surahId=1&ayahNumber=1&tafsirId=Ibn_Kathir")
    text = (d.get("data") or {}).get("textAr") or (d.get("data") or {}).get("text") or ""
    check("tafsir", st == 200 and len(str(text)) > 40, f"keys={list((d.get('data') or {}).keys())}")

    st, d, _ = get("/quran/translation?surahId=1&ayahNumber=1&translationId=Sahih_International")
    text = (d.get("data") or {}).get("text") or (d.get("data") or {}).get("textEn") or ""
    check("translation", st == 200 and len(str(text)) > 10, f"keys={list((d.get('data') or {}).keys())}")

    for path in [
        "/adhkar",
        "/adhkar/search?q=subhan",
        "/qibla/calculate?lat=30.0444&lng=31.2357",
        "/quran/ayahs/random",
        "/content/verse-of-day",
    ]:
        st, d, _ = get(path)
        check(f"public_{path.split('?')[0]}", st == 200, f"HTTP {st} {d.get('code')}")

    st, d, _ = get("/profile/azan-preferences")
    check("azan_prefs_not_required", st in (401, 404), f"HTTP {st}")

    suffix = "".join(random.choices(string.ascii_lowercase + string.digits, k=8))
    email = f"contract_{suffix}@example.com"
    password = "ContractTest1!"
    st, d, _ = req(
        "POST",
        "/auth/sign-up",
        {"fullName": "Contract Audit", "email": email, "password": password, "username": f"c{suffix}"},
    )
    token = None
    if st in (200, 201):
        token = ((d.get("data") or {}).get("tokens") or {}).get("accessToken")
    check("signup", bool(token), f"HTTP {st} {d.get('code')}")

    if not token:
        print("---")
        fails = [n for n, c, _ in results if not c]
        print(f"PASSED {sum(1 for _, c, _ in results if c)}/{len(results)}")
        print("FAILED:", ", ".join(fails))
        return 1

    st, d, _ = get("/dashboard", token=token)
    data = d.get("data") or {}
    prayers = data.get("prayers") or {}
    sch = prayers.get("schedule") or []
    dj = data.get("dailyJourney") or {}
    check(
        "dashboard_keys",
        all(
            k in data
            for k in [
                "greeting",
                "prayers",
                "verseOfTheDay",
                "hadithOfTheDay",
                "dailyJourney",
                "khatmah",
                "dailyChallenge",
                "utilities",
            ]
        ),
        str(list(data.keys())),
    )
    check(
        "dashboard_schedule",
        len(sch) == 5 and all(isinstance(p.get("completed"), bool) for p in sch),
        str([(p.get("name"), p.get("time"), type(p.get("completed")).__name__) for p in sch]),
    )
    check(
        "dashboard_adhkar_bool",
        isinstance((dj.get("adhkar") or {}).get("completed"), bool),
        str(dj.get("adhkar")),
    )
    check("dashboard_quran_target", (dj.get("quran") or {}).get("target") == 5, str(dj.get("quran")))
    check(
        "dashboard_prayer_frac",
        0 <= float((dj.get("prayer") or {}).get("progress", -1)) <= 1,
        str(dj.get("prayer")),
    )
    kh = data.get("khatmah") or {}
    check(
        "dashboard_khatmah_name",
        bool(kh.get("surahNameAr")) and not str(kh.get("surahNameAr")).isdigit(),
        str(kh),
    )
    dc = data.get("dailyChallenge") or {}
    check("dashboard_challenge_en", bool(dc.get("titleEn") and dc.get("descriptionEn")), str(list(dc.keys())))

    # journey labels on dashboard
    check(
        "dashboard_journey_en",
        bool((dj.get("prayer") or {}).get("labelEn")) and bool((dj.get("quran") or {}).get("labelEn")),
        str({k: (dj.get(k) or {}).get("labelEn") for k in ("prayer", "quran", "adhkar", "sadaqah")}),
    )

    st, d, _ = get("/journey/today", token=token)
    data = d.get("data") or {}
    tasks = {t["key"]: t for t in data.get("tasks") or []}
    pr = tasks.get("prayer") or {}
    check("journey_prayer_counts", all(k in pr for k in ("completed", "total", "progress")), str(pr))
    check("journey_en", all(t.get("titleEn") for t in tasks.values()))
    check("journey_badges", isinstance(data.get("badges"), list) and len(data.get("badges")) > 0)
    check(
        "journey_challenge",
        isinstance(data.get("dailyChallenge"), dict) and "titleEn" in (data.get("dailyChallenge") or {}),
    )

    st, d, _ = get("/journey/badges", token=token)
    check("GET_journey_badges", st == 200 and isinstance((d.get("data") or {}).get("badges"), list))

    st, d, _ = get("/journey/progress?days=7", token=token)
    data = d.get("data") or {}
    check(
        "journey_progress",
        st == 200 and ("daily" in data or "records" in data) and "summary" in data,
        str(list(data.keys())),
    )

    st, d, _ = req("PATCH", "/journey/prayer", {"prayer": "Asr", "completed": True}, token=token)
    check("PATCH_prayer_Asr", st == 200, f"HTTP {st} {d.get('code')}")
    st, d, _ = req(
        "PATCH", "/journey/adhkar", {"categoryKey": "GENERAL_WIRD", "completed": True}, token=token
    )
    check("PATCH_adhkar", st == 200, f"HTTP {st}")
    st, d, _ = req("PATCH", "/journey/sadaqah", {"amount": 5}, token=token)
    check("PATCH_sadaqah", st == 200, f"HTTP {st}")
    st, d, _ = req("POST", "/journey/quran-pages/increment", {"pages": 1}, token=token)
    check("POST_quran_inc", st == 200, f"{d.get('data')}")

    st, d, _ = get("/notifications?page=1&perPage=20", token=token)
    check("notifications_list_array", st == 200 and isinstance(d.get("data"), list), type(d.get("data")).__name__)
    st, d, _ = get("/notifications/unread-count", token=token)
    data = d.get("data") or {}
    check("unread_count", st == 200 and ("count" in data or "unreadCount" in data), str(data))
    st, d, _ = req("POST", "/notifications/read-all", token=token)
    check("read_all", st == 200)

    st, d, _ = get("/profile/me", token=token)
    data = d.get("data") or {}
    check("profile_me", all(k in data for k in ("id", "email", "fullName", "provider")), str(list(data.keys())[:18]))
    st, d, _ = req("PUT", "/profile/location", {"latitude": 30.0444, "longitude": 31.2357}, token=token)
    check("profile_location", st == 200)
    st, d, _ = get("/qibla/my-qibla", token=token)
    check("my_qibla", st == 200 and "bearingDegrees" in (d.get("data") or {}))

    st, d, _ = req(
        "PATCH",
        "/profile/reading-preferences",
        {"quranAutoScroll": True, "quranFontSize": 28},
        token=token,
    )
    data = d.get("data") or {}
    check("prefs_autoscroll", st == 200 and data.get("quranAutoScroll") is True, str(data.get("quranAutoScroll")))

    st, d, _ = get("/adhkar/progress?categoryKey=MORNING", token=token)
    check("adhkar_progress", st == 200 and "categoryKey" in (d.get("data") or {}), str(list((d.get("data") or {}).keys())))
    st, d, _ = get("/adhkar", token=token)
    home = d.get("data") or {}
    check(
        "adhkar_home_en",
        all(k in home for k in ("greetingEn", "titleEn", "ctaEn"))
        and bool(home.get("titleEn"))
        and bool(home.get("ctaEn")),
        str({k: home.get(k) for k in ("greeting", "greetingEn", "titleAr", "titleEn", "ctaAr", "ctaEn")}),
    )
    st, d, _ = get("/adhkar/favorites", token=token)
    check("adhkar_favorites", st == 200)

    st, d, _ = req("POST", "/quran/import-local", {"bookmarks": [], "lastRead": None}, token=token)
    check("import_local_null", st == 200, f"HTTP {st} {d.get('code')} {d.get('details')}")
    st, d, _ = req(
        "POST",
        "/quran/import-local",
        {
            "bookmarks": [{"surahId": 1, "ayahNumber": 1, "note": "t"}],
            "lastRead": {"surahId": 1, "pageNumber": 1, "ayahNumber": 1},
        },
        token=token,
    )
    data = d.get("data") or {}
    check(
        "import_local_data",
        st == 200
        and isinstance(data.get("bookmarksImported"), int)
        and isinstance(data.get("lastReadUpdated"), bool),
        f"HTTP {st} {data}",
    )

    st, d, _ = req("POST", "/quran/bookmarks", {"surahId": 3, "ayahNumber": 1}, token=token)
    bm = d.get("data") or {}
    check(
        "bookmark_name",
        st in (200, 201) and bm.get("surahNameAr") and not str(bm.get("surahNameAr")).isdigit(),
        str(bm.get("surahNameAr")),
    )
    bid = bm.get("id")
    if bid:
        st, d, _ = req("PATCH", f"/quran/bookmarks/{bid}", {"note": "note-x"}, token=token)
        check("bookmark_note_patch", st == 200 and (d.get("data") or {}).get("note") == "note-x")
    else:
        check("bookmark_note_patch", False, "no bookmark id")

    st, d, _ = req("PUT", "/quran/last-read", {"surahId": 2, "ayahNumber": 5, "page": 10}, token=token)
    lr = d.get("data") or {}
    check(
        "last_read_name",
        st == 200 and lr.get("surahNameAr") and not str(lr.get("surahNameAr")).isdigit(),
        str({k: lr.get(k) for k in ("surahNameAr", "ayahNumber", "page")}),
    )

    st, d, _ = get("/challenges", token=token)
    check("challenges_list", st == 200)
    st, d, _ = get("/challenges/today", token=token)
    today = d.get("data") or {}
    check("challenges_today", st == 200, str(list(today.keys())[:12]))
    cid = today.get("id") or (today.get("challenge") or {}).get("id")
    if cid:
        st, d, _ = get(f"/challenges/{cid}", token=token)
        check("challenges_by_id", st == 200)
    else:
        # list may have ids
        st2, d2, _ = get("/challenges", token=token)
        items = d2.get("data") if isinstance(d2.get("data"), list) else (d2.get("data") or {}).get("items") or []
        cid2 = items[0].get("id") if items else None
        if cid2:
            st, d, _ = get(f"/challenges/{cid2}", token=token)
            check("challenges_by_id", st == 200, f"from list {cid2}")
        else:
            check("challenges_by_id", False, "no challenge id available")

    st, d, _ = get("/quran/reading-history", token=token)
    check("reading_history", st == 200)
    st, d, _ = req("POST", "/quran/khatmah/reset", {}, token=token)
    check("khatmah_reset", st == 200)

    st, d, _ = get("/tasbih/today", token=token)
    data = d.get("data") or {}
    check(
        "tasbih_fields",
        all(k in data for k in ("count", "dailyGoal", "progressPercent"))
        and ("dhikrAr" in data or "dhikr" in data),
        str(list(data.keys())),
    )
    check("tasbih_en", "dhikrEn" in data, str(data.get("dhikrEn")))

    st, d, _ = req("POST", "/auth/forgot-password", {"email": email})
    check("forgot_password_api", st == 200, str(d.get("message")))

    # probe mail provider via response meta if any (usually not)
    # check notifications EN when present
    st, d, _ = get("/notifications?page=1&perPage=5", token=token)
    items = d.get("data") or []
    if items:
        it = items[0]
        check("notif_en_fields", "titleEn" in it and "bodyEn" in it, str(list(it.keys())))
    else:
        check("notif_en_fields", True, "empty list — shape verified when items exist")

    st, d, _ = get("/quran/reciters")
    fail = 0
    for r in d.get("data") or []:
        st2, d2, _ = get(f"/quran/audio?surahId=1&ayahNumber=1&reciterId={r.get('id')}")
        u = (d2.get("data") or {}).get("audioUrl")
        if st2 != 200 or not str(u).startswith("http"):
            fail += 1
    check("all_reciters_audio", fail == 0, f"fail={fail}")

    st, d, _ = get("/quran/tafsirs")
    fail = 0
    for t in d.get("data") or []:
        st2, d2, _ = get(f"/quran/tafsir?surahId=1&ayahNumber=1&tafsirId={t.get('id')}")
        text = (d2.get("data") or {}).get("textAr") or (d2.get("data") or {}).get("text") or ""
        if st2 != 200 or len(str(text)) < 20:
            fail += 1
    check("all_tafsirs_content", fail == 0, f"fail={fail}")

    st, d, _ = get("/quran/translations")
    fail = 0
    for t in d.get("data") or []:
        st2, d2, _ = get(f"/quran/translation?surahId=1&ayahNumber=1&translationId={t.get('id')}")
        text = (d2.get("data") or {}).get("text") or (d2.get("data") or {}).get("textEn") or ""
        if st2 != 200 or len(str(text)) < 5:
            fail += 1
    check("all_translations_content", fail == 0, f"fail={fail}")

    print("---")
    fails = [n for n, c, _ in results if not c]
    print(f"PASSED {sum(1 for _, c, _ in results if c)}/{len(results)}")
    if fails:
        print("FAILED:", ", ".join(fails))
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
