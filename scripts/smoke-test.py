"""
Smoke test suite against the deployed Noor API.
Run: python scripts/smoke-test.py
"""
import json
import time
import urllib.request
import urllib.error
import urllib.parse

BASE = "https://noor-app-backend-one.vercel.app/api/v1"

PASS = []
FAIL = []
SKIP = []

def req(method, path, body=None, headers=None, range_hdr=None):
    url = BASE + path
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if headers:
        hdrs.update(headers)
    if range_hdr:
        hdrs["Range"] = range_hdr
    r = urllib.request.Request(url, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, raw, dict(resp.headers)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        return e.code, raw, dict(e.headers)

def check(label, status, raw, resp_hdrs=None,
          expect_status=200, expect_success=True,
          required_keys=None, required_data_keys=None,
          check_fn=None, skip_json=False):
    if skip_json:
        # For Range responses: raw is a binary chunk, not parseable JSON.
        # Just validate the HTTP status code and any header checks.
        ok = (status == expect_status)
        notes = [] if ok else [f"HTTP {status} != expected {expect_status}"]
        if check_fn and ok:
            result = check_fn({}, resp_hdrs or {})
            if result:
                ok = False; notes.append(result)
        symbol = "  PASS" if ok else "  FAIL"
        note_str = " | " + "; ".join(notes) if notes else ""
        print(f"{symbol}  [{status}] {label}{note_str}")
        if ok: PASS.append(label)
        else: FAIL.append(f"{label}: {'; '.join(notes)}")
        return None

    try:
        d = json.loads(raw)
    except Exception as e:
        FAIL.append(f"{label}: JSON parse error — {e}")
        print(f"  FAIL  {label}: JSON parse error")
        return None

    ok = True
    notes = []

    if status != expect_status:
        ok = False
        notes.append(f"HTTP {status} != expected {expect_status}")

    if d.get("success") != expect_success:
        ok = False
        notes.append(f"success={d.get('success')} != {expect_success}")

    if expect_success:
        if "timestamp" not in d:
            ok = False; notes.append("missing timestamp")
        if "requestId" not in d:
            ok = False; notes.append("missing requestId")

    if required_keys:
        for k in required_keys:
            if k not in d:
                ok = False; notes.append(f"top-level key missing: {k}")

    if required_data_keys and isinstance(d.get("data"), dict):
        for k in required_data_keys:
            if k not in d["data"]:
                ok = False; notes.append(f"data key missing: {k}")

    if check_fn:
        result = check_fn(d, resp_hdrs or {})
        if result:
            ok = False; notes.append(result)

    symbol = "  PASS" if ok else "  FAIL"
    note_str = " | " + "; ".join(notes) if notes else ""
    print(f"{symbol}  [{status}] {label}{note_str}")
    if ok:
        PASS.append(label)
    else:
        FAIL.append(f"{label}: {'; '.join(notes)}")
    return d

# ─────────────────────────────────────────────────────────────────────────────
print("\n" + "="*70)
print("NOOR API SMOKE TEST — deployed:", BASE)
print("="*70)

# ── HEALTH ───────────────────────────────────────────────────────────────────
print("\n── Health ──")
s, r, h = req("GET", "/health")
check("GET /health", s, r, expect_status=200,
      check_fn=lambda d,_: None if d.get("data",{}).get("database")=="connected" else "database not connected")

# ── AUTH: SIGN-UP ─────────────────────────────────────────────────────────────
print("\n── Auth ──")
ts = int(time.time())
EMAIL = f"smoketest{ts}@noor.test"
s, r, h = req("POST", "/auth/sign-up", {"fullName": "Smoke Test", "email": EMAIL, "password": "TestPass1234"})
d = check("POST /auth/sign-up", s, r, expect_status=201,
    check_fn=lambda d,_: None if (
        isinstance(d.get("data",{}).get("tokens"), dict) and
        "accessToken" in d["data"]["tokens"] and
        "refreshToken" in d["data"]["tokens"] and
        "expiresIn" in d["data"]["tokens"] and
        d["data"]["user"].get("provider") == "LOCAL"
    ) else "tokens nesting or user.provider wrong")

if d and d.get("data"):
    AT = d["data"]["tokens"]["accessToken"]
    RT = d["data"]["tokens"]["refreshToken"]
else:
    print("  SKIP  Cannot continue auth tests — sign-up failed")
    AT = RT = None

# ── AUTH: LOGIN ──────────────────────────────────────────────────────────────
if AT:
    s, r, h = req("POST", "/auth/login", {"email": EMAIL, "password": "TestPass1234"})
    check("POST /auth/login", s, r, expect_status=200,
        check_fn=lambda d,_: None if (
            "tokens" in d.get("data",{}) and
            all(k in d["data"]["tokens"] for k in ["accessToken","refreshToken","expiresIn"])
        ) else "tokens missing or malformed")

    # ── AUTH: ME ─────────────────────────────────────────────────────────────
    s, r, h = req("GET", "/auth/me", headers={"Authorization": f"Bearer {AT}"})
    check("GET /auth/me (valid token)", s, r, expect_status=200,
        required_data_keys=["id","email","provider"],
        check_fn=lambda d,_: None if all(k in d.get("data",{}) for k in
            ["id","email","provider","displayName","username"]) else "missing alias fields")

    s, r, h = req("GET", "/auth/me")
    check("GET /auth/me (no token → 401)", s, r, expect_status=401, expect_success=False,
        check_fn=lambda d,_: None if d.get("code") in ["UNAUTHORIZED","INVALID_TOKEN"] else f"wrong code: {d.get('code')}")

    # ── AUTH: REFRESH ────────────────────────────────────────────────────────
    s, r, h = req("POST", "/auth/refresh", {"refreshToken": RT})
    d2 = check("POST /auth/refresh", s, r, expect_status=200,
        check_fn=lambda d,_: None if "tokens" in d.get("data",{}) else "tokens missing")
    if d2 and d2.get("data"):
        AT = d2["data"]["tokens"]["accessToken"]  # use new token

    # ── AUTH: LOGOUT (valid) ──────────────────────────────────────────────────
    s, r, h = req("POST", "/auth/logout", {"refreshToken": RT})
    check("POST /auth/logout (valid token)", s, r, expect_status=200)

    # ── AUTH: LOGOUT (garbage — must not 400) ────────────────────────────────
    s, r, h = req("POST", "/auth/logout", {"refreshToken": "garbagetoken.invalid.here"})
    check("POST /auth/logout (garbage token → 200)", s, r, expect_status=200,
        check_fn=lambda d,_: None if d.get("success") == True else "should succeed even with bad token")

    # ── AUTH: FORGOT PASSWORD ─────────────────────────────────────────────────
    s, r, h = req("POST", "/auth/forgot-password", {"email": EMAIL})
    check("POST /auth/forgot-password", s, r, expect_status=200)

    # ── VALIDATION ERROR shape ─────────────────────────────────────────────────
    s, r, h = req("POST", "/auth/sign-up", {"fullName": "X", "email": "bad", "password": "x"})
    check("POST /auth/sign-up bad input → 400 VALIDATION_ERROR", s, r, expect_status=400, expect_success=False,
        check_fn=lambda d,_: None if d.get("code")=="VALIDATION_ERROR" and isinstance(d.get("errors"),list)
            else f"code={d.get('code')} errors_type={type(d.get('errors')).__name__}")

# ── DASHBOARD ────────────────────────────────────────────────────────────────
print("\n── Dashboard ──")
if AT:
    s, r, h = req("GET", "/dashboard", headers={"Authorization": f"Bearer {AT}"})
    check("GET /dashboard", s, r, expect_status=200,
        check_fn=lambda d,_: None if all(k in d.get("data",{}) for k in [
            "greeting","prayers","verseOfTheDay","hadithOfTheDay",
            "dailyJourney","khatmah","dailyChallenge","utilities"]) else "missing top-level sections")

    def check_dashboard(d, _):
        data = d.get("data", {})
        errors = []
        # greeting
        g = data.get("greeting", {})
        for k in ["displayName","weekdayName","hijriDate","points"]:
            if k not in g: errors.append(f"greeting.{k} missing")
        # prayers
        p = data.get("prayers", {})
        sched = p.get("schedule", [])
        if sched:
            item = sched[0]
            for k in ["name","nameAr","time","completed"]:
                if k not in item: errors.append(f"prayers.schedule[0].{k} missing")
            # time must be HH:mm
            t = item.get("time","")
            if not (len(t)==5 and t[2]==":"): errors.append(f"prayers.schedule[0].time not HH:mm: {t!r}")
        # khatmah
        km = data.get("khatmah", {})
        if not km.get("surahNameAr") or km.get("surahNameAr","").isdigit():
            errors.append(f"khatmah.surahNameAr is bad: {km.get('surahNameAr')!r}")
        # dailyChallenge
        dc = data.get("dailyChallenge", {})
        for k in ["titleAr","descriptionAr","rewardPoints","targetValue","completed","claimed"]:
            if k not in dc: errors.append(f"dailyChallenge.{k} missing")
        # dailyJourney
        dj = data.get("dailyJourney", {})
        for k in ["prayer","quran","adhkar","sadaqah"]:
            if k not in dj: errors.append(f"dailyJourney.{k} missing")
        return "; ".join(errors) if errors else None

    check("GET /dashboard — deep field check", s, r, expect_status=200, check_fn=check_dashboard)

# ── QURAN PUBLIC ──────────────────────────────────────────────────────────────
print("\n── Quran Public (guest, no token) ──")
s, r, h = req("GET", "/quran/surahs")
def chk_surahs(d, _):
    surahs = d.get("data", [])
    if not isinstance(surahs, list) or len(surahs) != 114:
        return f"expected 114 surahs, got {len(surahs)}"
    s3 = next((x for x in surahs if x["id"]==3), None)
    if not s3: return "surah 3 not found"
    if s3.get("nameAr","").strip().isdigit() or s3.get("nameAr","") in ("","3"):
        return f"surah 3 nameAr is bare id: {s3.get('nameAr')!r}"
    for k in ["id","nameAr","nameEn","revelationType","totalAyahs","totalPages","startPage"]:
        if k not in s3: return f"surah object missing field: {k}"
    return None
check("GET /quran/surahs (114 surahs, names resolved)", s, r, check_fn=chk_surahs)

s, r, h = req("GET", "/quran/juz")
check("GET /quran/juz (30 juz)", s, r,
    check_fn=lambda d,_: None if len(d.get("data",[])) == 30 else f"juz count={len(d.get('data',[]))}")

s, r, h = req("GET", "/quran/juz/3/surahs")
def chk_juz_surahs(d, _):
    data = d.get("data", {})
    surahs = data.get("surahs", [])
    if not surahs: return "no surahs in juz"
    s = surahs[0]
    for k in ["id","nameAr","nameEn"]: 
        if k not in s: return f"surah missing {k}"
    if s.get("nameAr","").isdigit(): return f"nameAr is bare id: {s.get('nameAr')!r}"
    return None
check("GET /quran/juz/3/surahs (names resolved)", s, r, check_fn=chk_juz_surahs)

s, r, h = req("GET", "/quran/pages/1")
def chk_page(d, _):
    data = d.get("data", {})
    if data.get("page") != 1: return f"page field={data.get('page')}"
    if data.get("totalPages") != 604: return f"totalPages={data.get('totalPages')}"
    surahs = data.get("surahs", [])
    if not surahs: return "surahs[] empty"
    if surahs[0].get("nameAr","").isdigit(): return f"surahs[0].nameAr bare: {surahs[0].get('nameAr')!r}"
    ayahs = data.get("ayahs", [])
    if not ayahs: return "ayahs[] empty"
    for k in ["surahId","ayahNumber","textAr","page","juz"]:
        if k not in ayahs[0]: return f"ayah missing {k}"
    return None
check("GET /quran/pages/1 (shape + names resolved)", s, r, check_fn=chk_page)

s, r, h = req("GET", "/quran/surahs/2/ayahs?page=1&perPage=1")
check("GET /quran/surahs/2/ayahs?page=1&perPage=1", s, r)

s, r, h = req("GET", "/quran/juz/1/ayahs")
def chk_juz_ayahs(d, _):
    data = d.get("data", {})
    if not data.get("ayahs"): return "no ayahs"
    surahs = data.get("surahs", [])
    if surahs and surahs[0].get("nameAr","").isdigit(): return f"surahs[0].nameAr bare: {surahs[0].get('nameAr')!r}"
    return None
check("GET /quran/juz/1/ayahs (surahs names resolved)", s, r, check_fn=chk_juz_ayahs)

# ── FULL CATALOG ──────────────────────────────────────────────────────────────
print("\n── Full Catalog + Range ──")
s, r, h = req("GET", "/quran/full-catalog")
def chk_catalog(d, _):
    meta = d.get("data", {}).get("meta", {})
    surahs = d.get("data", {}).get("surahs", [])
    errors = []
    if meta.get("totalAyahs") != 6236: errors.append(f"totalAyahs={meta.get('totalAyahs')}")
    if meta.get("bismillahStripped") != True: errors.append("bismillahStripped not true")
    if len(surahs) != 114: errors.append(f"surah count={len(surahs)}")
    s3 = next((x for x in surahs if x["id"]==3), None)
    if s3 and s3.get("nameAr","").isdigit(): errors.append(f"s3.nameAr bare: {s3['nameAr']!r}")
    # bismillah rule: surah 3 ayah 1 should not start with bsm
    if s3 and s3.get("ayahs"):
        a1 = s3["ayahs"][0].get("textAr","")
        if "بسم" in a1[:10] or "\u0628\u0650\u0633\u0652\u0645" in a1[:10]:
            errors.append("surah 3 ayah1 bismillah not stripped")
    s9 = next((x for x in surahs if x["id"]==9), None)
    if s9 and s9.get("ayahs"):
        a1_9 = s9["ayahs"][0].get("textAr","")
        if not a1_9: errors.append("surah 9 ayah1 empty")
    return "; ".join(errors) if errors else None
check("GET /quran/full-catalog (200, meta, names, bismillah)", s, r, check_fn=chk_catalog)

# Range: bytes=0-1023
s2, r2, h2 = req("GET", "/quran/full-catalog", range_hdr="bytes=0-1023")
def chk_range(d, hdrs):
    errors = []
    ar = hdrs.get("Accept-Ranges","")
    cr = hdrs.get("Content-Range","")
    if ar != "bytes": errors.append(f"Accept-Ranges={ar!r}")
    if not cr.startswith("bytes 0-1023/"): errors.append(f"Content-Range={cr!r}")
    return "; ".join(errors) if errors else None
check("GET /quran/full-catalog Range:bytes=0-1023 → 206", s2, r2, h2,
      expect_status=206, check_fn=chk_range, skip_json=True)

# Range: mid-file
s3b, r3b, h3b = req("GET", "/quran/full-catalog", range_hdr="bytes=500000-510000")
check("GET /quran/full-catalog Range:bytes=500000-510000 → 206", s3b, r3b, h3b,
      expect_status=206, skip_json=True)

# ── QURAN AUTHENTICATED ───────────────────────────────────────────────────────
print("\n── Quran Authenticated ──")
if AT:
    # Bookmarks
    s, r, h = req("GET", "/quran/bookmarks", headers={"Authorization": f"Bearer {AT}"})
    check("GET /quran/bookmarks", s, r)

    s, r, h = req("POST", "/quran/bookmarks",
        body={"surahId": 2, "ayahNumber": 255, "page": 42},
        headers={"Authorization": f"Bearer {AT}"})
    def chk_bmark(d, _):
        b = d.get("data", {})
        errors = []
        for k in ["id","surahId","ayahNumber","page","surahNameAr","surah"]:
            if k not in b: errors.append(f"missing {k}")
        if b.get("surahNameAr","").isdigit(): errors.append(f"surahNameAr bare: {b.get('surahNameAr')!r}")
        if not isinstance(b.get("surah"), dict): errors.append("surah not a dict")
        else:
            if not b["surah"].get("nameAr"): errors.append("surah.nameAr missing")
        return "; ".join(errors) if errors else None
    check("POST /quran/bookmarks (shape + surahNameAr)", s, r, expect_status=201, check_fn=chk_bmark)

    try:
        BID = json.loads(r)["data"]["id"]
        s, r, h = req("DELETE", f"/quran/bookmarks/{BID}", headers={"Authorization": f"Bearer {AT}"})
        check(f"DELETE /quran/bookmarks/:id", s, r, expect_status=200)
    except: SKIP.append("DELETE /quran/bookmarks/:id — could not extract ID")

    # Last-read
    s, r, h = req("PUT", "/quran/last-read",
        body={"surahId": 2, "ayahNumber": 255, "page": 42},
        headers={"Authorization": f"Bearer {AT}"})
    def chk_lr(d, _):
        lr = d.get("data", {})
        errors = []
        for k in ["surahId","page","ayahNumber","juz","surahNameAr","surah"]:
            if k not in lr: errors.append(f"missing {k}")
        if lr.get("surahNameAr","").isdigit(): errors.append("surahNameAr bare")
        if lr.get("juz") != 3: errors.append(f"juz={lr.get('juz')} (expected 3 for 2:255)")
        return "; ".join(errors) if errors else None
    check("PUT /quran/last-read (shape + juz + surahNameAr)", s, r, check_fn=chk_lr)

    s, r, h = req("GET", "/quran/last-read", headers={"Authorization": f"Bearer {AT}"})
    check("GET /quran/last-read", s, r)

    # Khatmah
    s, r, h = req("PATCH", "/quran/khatmah/progress",
        body={"surahId": 3, "currentPage": 50, "pagesRead": 2},
        headers={"Authorization": f"Bearer {AT}"})
    def chk_km(d, _):
        km = d.get("data", {})
        errors = []
        for k in ["surahId","surahNameAr","surahNameEn","currentPage","progressPercent"]:
            if k not in km: errors.append(f"missing {k}")
        if km.get("surahNameAr","").isdigit(): errors.append(f"surahNameAr bare: {km.get('surahNameAr')!r}")
        return "; ".join(errors) if errors else None
    check("PATCH /quran/khatmah/progress (surahNameAr resolved)", s, r, check_fn=chk_km)

    s, r, h = req("GET", "/quran/khatmah/stats", headers={"Authorization": f"Bearer {AT}"})
    def chk_stats(d, _):
        km = d.get("data", {})
        errors = []
        if km.get("surahNameAr","").isdigit(): errors.append("surahNameAr bare")
        if "dailyGoal" not in km: errors.append("missing dailyGoal")
        if "stats" not in km: errors.append("missing stats")
        return "; ".join(errors) if errors else None
    check("GET /quran/khatmah/stats (surahNameAr + stats)", s, r, check_fn=chk_stats)

# ── READING PREFERENCES ────────────────────────────────────────────────────────
print("\n── Reading Preferences ──")
if AT:
    s, r, h = req("GET", "/profile/reading-preferences", headers={"Authorization": f"Bearer {AT}"})
    check("GET /profile/reading-preferences", s, r,
        required_data_keys=["quranFontSize","quranReciter","quranTafsir","quranTranslation"])

    s, r, h = req("PATCH", "/profile/reading-preferences",
        body={"quranFontSize": 32},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/reading-preferences {fontSize:32}", s, r,
        check_fn=lambda d,_: None if d.get("data",{}).get("quranFontSize")==32 else f"fontSize={d.get('data',{}).get('quranFontSize')}")

    # Font clamp: 11 should 400
    s, r, h = req("PATCH", "/profile/reading-preferences",
        body={"quranFontSize": 11},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/reading-preferences fontSize=11 → 400", s, r,
        expect_status=400, expect_success=False)

    s, r, h = req("PATCH", "/profile/reading-preferences",
        body={"quranFontSize": 61},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/reading-preferences fontSize=61 → 400", s, r,
        expect_status=400, expect_success=False)

# ── ADHKAR ───────────────────────────────────────────────────────────────────
print("\n── Adhkar (public) ──")
s, r, h = req("GET", "/adhkar")
def chk_adhkar_home(d, _):
    data = d.get("data", {})
    errors = []
    if "greeting" not in data: errors.append("missing greeting")
    dw = data.get("dailyWird", {})
    for k in ["titleAr","progressItemsDone","progressItemsTotal","progressPercent","ctaAr","categoryKey","items"]:
        if k not in dw: errors.append(f"dailyWird.{k} missing")
    cats = data.get("categories", [])
    if not cats: errors.append("categories empty")
    else:
        c = cats[0]
        for k in ["id","key","nameAr","nameEn","iconCode","sortOrder","totalItems"]:
            if k not in c: errors.append(f"category.{k} missing")
    return "; ".join(errors) if errors else None
check("GET /adhkar (home shape)", s, r, check_fn=chk_adhkar_home)

s, r, h = req("GET", "/adhkar/categories/MORNING")
def chk_adhkar_cat(d, _):
    data = d.get("data", {})
    errors = []
    if data.get("key") != "MORNING": errors.append(f"key={data.get('key')!r}")
    items = data.get("items", [])
    if not items: errors.append("no items")
    else:
        item = items[0]
        for k in ["id","orderInCategory","textAr","repeatCount","referenceAr"]:
            if k not in item: errors.append(f"item.{k} missing")
    return "; ".join(errors) if errors else None
check("GET /adhkar/categories/MORNING (items shape)", s, r, check_fn=chk_adhkar_cat)

# Adhkar progress (authenticated)
if AT:
    s, r, h = req("GET", "/adhkar/progress?categoryKey=MORNING", headers={"Authorization": f"Bearer {AT}"})
    check("GET /adhkar/progress?categoryKey=MORNING", s, r,
        check_fn=lambda d,_: None if all(k in d.get("data",{}) for k in
            ["categoryKey","markedItemId","items","progressItemsDone","progressItemsTotal","progressPercent"])
            else f"missing keys in data: {list(d.get('data',{}).keys())}")

    s, r, h = req("GET", "/adhkar/progress?categoryKey=MORNING")
    check("GET /adhkar/progress no token → 401", s, r, expect_status=401, expect_success=False)

# ── JOURNEY ──────────────────────────────────────────────────────────────────
print("\n── Journey ──")
if AT:
    s, r, h = req("GET", "/journey/today", headers={"Authorization": f"Bearer {AT}"})
    def chk_journey_today(d, _):
        data = d.get("data", {})
        errors = []
        for k in ["date","tasks","streakDays","badges","points"]:
            if k not in data: errors.append(f"missing {k}")
        tasks = data.get("tasks", [])
        keys_found = {t.get("key") for t in tasks}
        for k in ["quran","prayer","adhkar","sadaqah"]:
            if k not in keys_found: errors.append(f"task {k!r} missing")
        return "; ".join(errors) if errors else None
    check("GET /journey/today (shape + all task keys)", s, r, check_fn=chk_journey_today)

    s, r, h = req("GET", "/journey/progress", headers={"Authorization": f"Bearer {AT}"})
    check("GET /journey/progress", s, r,
        check_fn=lambda d,_: None if all(k in d.get("data",{}) for k in ["periodDays","daily","summary"])
            else f"missing keys: {list(d.get('data',{}).keys())}")

    s, r, h = req("POST", "/journey/quran-pages/increment",
        body={"pages": 1}, headers={"Authorization": f"Bearer {AT}"})
    check("POST /journey/quran-pages/increment", s, r,
        check_fn=lambda d,_: None if "quranPagesRead" in d.get("data",{}) else "missing quranPagesRead")

    s, r, h = req("PATCH", "/journey/adhkar",
        body={"completed": True}, headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /journey/adhkar", s, r,
        check_fn=lambda d,_: None if "adhkarCompleted" in d.get("data",{}) else "missing adhkarCompleted")

    s, r, h = req("PATCH", "/journey/sadaqah",
        body={"amount": 10}, headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /journey/sadaqah", s, r,
        check_fn=lambda d,_: None if "sadaqahAmount" in d.get("data",{}) else "missing sadaqahAmount")

# ── TASBIH ────────────────────────────────────────────────────────────────────
print("\n── Tasbih ──")
if AT:
    s, r, h = req("GET", "/tasbih/today", headers={"Authorization": f"Bearer {AT}"})
    def chk_tasbih(d, _):
        data = d.get("data", {})
        errors = []
        for k in ["count","dhikr","dhikrAr","dailyGoal","progressPercent",
                  "todayCount","currentDhikr","currentDhikrAr","currentDhikrCount"]:
            if k not in data: errors.append(f"missing {k}")
        return "; ".join(errors) if errors else None
    check("GET /tasbih/today (all fields + aliases)", s, r, check_fn=chk_tasbih)

    s, r, h = req("POST", "/tasbih/increment",
        body={"amount": 3}, headers={"Authorization": f"Bearer {AT}"})
    check("POST /tasbih/increment", s, r,
        check_fn=lambda d,_: None if "count" in d.get("data",{}) else "missing count")

    s, r, h = req("POST", "/tasbih/reset", headers={"Authorization": f"Bearer {AT}"})
    check("POST /tasbih/reset", s, r)

    s, r, h = req("PATCH", "/tasbih/change-dhikr",
        body={"dhikr": "SUBHAN_ALLAH"}, headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /tasbih/change-dhikr", s, r,
        check_fn=lambda d,_: None if d.get("data",{}).get("dhikr")=="SUBHAN_ALLAH" else "dhikr not updated")

# ── QIBLA ────────────────────────────────────────────────────────────────────
print("\n── Qibla (public) ──")
s, r, h = req("GET", "/qibla/calculate?lat=30.0444&lng=31.2357")
def chk_qibla(d, _):
    data = d.get("data", {})
    errors = []
    for k in ["bearingDegrees","bearingRadians","directionAr","distanceKm","userLocation"]:
        if k not in data: errors.append(f"missing {k}")
    ul = data.get("userLocation", {})
    if "latitude" not in ul or "longitude" not in ul:
        errors.append(f"userLocation malformed: {ul}")
    if not isinstance(data.get("bearingDegrees"), (int,float)): errors.append("bearingDegrees not numeric")
    if not isinstance(data.get("distanceKm"), (int,float)): errors.append("distanceKm not numeric")
    return "; ".join(errors) if errors else None
check("GET /qibla/calculate?lat=30.0444&lng=31.2357 (all fields)", s, r, check_fn=chk_qibla)

s, r, h = req("GET", "/qibla/calculate?lat=30.0444&lng=31.2357", headers={"Authorization": "Bearer none"})
# should still work — public route — or fail with 401 on bad token; let's just check it returns valid data
check("GET /qibla/calculate (no real token — public)", req("GET", "/qibla/calculate?lat=30.0444&lng=31.2357")[0],
      req("GET", "/qibla/calculate?lat=30.0444&lng=31.2357")[1], expect_status=200)

# ── NOTIFICATIONS ─────────────────────────────────────────────────────────────
print("\n── Notifications ──")
if AT:
    s, r, h = req("GET", "/notifications", headers={"Authorization": f"Bearer {AT}"})
    check("GET /notifications", s, r,
        check_fn=lambda d,_: None if isinstance(d.get("data"),list) else "data not a list")

    s, r, h = req("GET", "/notifications/unread-count", headers={"Authorization": f"Bearer {AT}"})
    check("GET /notifications/unread-count", s, r,
        check_fn=lambda d,_: None if "unreadCount" in d.get("data",{}) else "missing unreadCount")

    s, r, h = req("POST", "/notifications/read-all", headers={"Authorization": f"Bearer {AT}"})
    check("POST /notifications/read-all", s, r,
        check_fn=lambda d,_: None if "markedCount" in d.get("data",{}) else "missing markedCount")

    s, r, h = req("GET", "/notifications")
    check("GET /notifications no token → 401", s, r, expect_status=401, expect_success=False)

# ── PROFILE ───────────────────────────────────────────────────────────────────
print("\n── Profile ──")
if AT:
    s, r, h = req("GET", "/profile/me", headers={"Authorization": f"Bearer {AT}"})
    check("GET /profile/me", s, r,
        required_data_keys=["id","email","username","fullName"])

    s, r, h = req("PATCH", "/profile/update",
        body={"fullName": "Smoke Updated"},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/update {fullName}", s, r,
        check_fn=lambda d,_: None if d.get("data",{}).get("fullName")=="Smoke Updated" else f"fullName={d.get('data',{}).get('fullName')!r}")

    s, r, h = req("PUT", "/profile/location",
        body={"latitude": 30.0444, "longitude": 31.2357, "timezone": "Africa/Cairo"},
        headers={"Authorization": f"Bearer {AT}"})
    check("PUT /profile/location", s, r)

    s, r, h = req("PATCH", "/profile/change-password",
        body={"currentPassword": "TestPass1234", "newPassword": "NewPass5678"},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/change-password (correct current)", s, r)

    s, r, h = req("PATCH", "/profile/change-password",
        body={"currentPassword": "WrongPassword", "newPassword": "NewPass5678"},
        headers={"Authorization": f"Bearer {AT}"})
    check("PATCH /profile/change-password (wrong current → 401)", s, r,
        expect_status=401, expect_success=False)

# ── FINAL SUMMARY ─────────────────────────────────────────────────────────────
print("\n" + "="*70)
print(f"RESULTS: {len(PASS)} passed  |  {len(FAIL)} failed  |  {len(SKIP)} skipped")
print("="*70)
if FAIL:
    print("\nFAILED:")
    for f in FAIL: print(f"  ✗ {f}")
if SKIP:
    print("\nSKIPPED:")
    for s in SKIP: print(f"  - {s}")
print()
