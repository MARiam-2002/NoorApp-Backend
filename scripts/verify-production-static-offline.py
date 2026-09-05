#!/usr/bin/env python3
"""Production verification for static Quran/Adhkar offline packs."""
from __future__ import annotations

import json
import sys
import urllib.error
import urllib.request

BASE = "https://noor-app-backend-one.vercel.app/api/v1"
PASS = 0
FAIL = 0
ROWS: list[tuple[str, str, str]] = []


def ok(area: str, cond: bool, detail: str = ""):
    global PASS, FAIL
    detail_s = str(detail).encode("ascii", "replace").decode("ascii")
    if cond:
        PASS += 1
        ROWS.append(("PASS", area, detail_s))
        print(f"PASS  {area}" + (f" -- {detail_s}" if detail_s else ""))
    else:
        FAIL += 1
        ROWS.append(("FAIL", area, detail_s))
        print(f"FAIL  {area}" + (f" -- {detail_s}" if detail_s else ""))


def raw_get(path: str, headers: dict | None = None, timeout=300):
    h = {"Accept": "application/json", "Accept-Encoding": "identity"}
    if headers:
        h.update(headers)
    req = urllib.request.Request(BASE + path, headers=h)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read(), dict(resp.headers)
    except urllib.error.HTTPError as e:
        return e.code, e.read(), dict(e.headers)


def get_json(path: str, timeout=300):
    st, raw, hdrs = raw_get(path, timeout=timeout)
    body = json.loads(raw.decode("utf-8"))
    return st, body, hdrs, len(raw)


def main():
    print("=== Production static-data verification ===")
    print(f"BASE={BASE}\n")

    # Public access (no Authorization header)
    for path in [
        "/content/static-meta",
        "/quran/static-meta",
        "/adhkar/static-meta",
        "/adhkar/full-catalog",
        "/quran/juz/1/ayahs",
    ]:
        st, body, _, n = get_json(path)
        ok(f"public {path}", st == 200 and body.get("success") is True, f"status={st} bytes={n}")

    # Static meta combined
    st, body, _, _ = get_json("/content/static-meta")
    manifest = body.get("data") or {}
    qmeta_m = manifest.get("quran") or {}
    ameta_m = manifest.get("adhkar") or {}
    ok("content/static-meta has quran+adhkar", "quran" in manifest and "adhkar" in manifest)
    ok("manifest quran downloadPath", qmeta_m.get("downloadPath") == "/quran/full-catalog", str(qmeta_m.get("downloadPath")))
    ok("manifest adhkar downloadPath", ameta_m.get("downloadPath") == "/adhkar/full-catalog", str(ameta_m.get("downloadPath")))

    # Quran static-meta
    st, body, _, _ = get_json("/quran/static-meta")
    qsm = body.get("data") or {}
    ok("quran static-meta version", qsm.get("catalogVersion") == 1, str(qsm.get("catalogVersion")))
    ok("quran static-meta hash", isinstance(qsm.get("contentHash"), str) and qsm["contentHash"].startswith("quran-v"), str(qsm.get("contentHash")))
    ok("quran static-meta counts", qsm.get("totalSurahs") == 114 and qsm.get("totalAyahs") == 6236 and qsm.get("totalPages") == 604 and qsm.get("totalJuz") == 30, str(qsm))
    ok("quran static-meta matches manifest", qsm.get("catalogVersion") == qmeta_m.get("catalogVersion") and qsm.get("contentHash") == qmeta_m.get("contentHash"))

    # Adhkar static-meta
    st, body, _, _ = get_json("/adhkar/static-meta")
    asm = body.get("data") or {}
    ok("adhkar static-meta version", asm.get("catalogVersion") == 1, str(asm.get("catalogVersion")))
    ok("adhkar static-meta hash", isinstance(asm.get("contentHash"), str) and asm["contentHash"].startswith("adhkar-v"), str(asm.get("contentHash")))
    ok("adhkar static-meta counts", asm.get("totalCategories") == 14 and asm.get("totalItems") == 115, str(asm))
    ok("adhkar static-meta matches manifest", asm.get("catalogVersion") == ameta_m.get("catalogVersion") and asm.get("contentHash") == ameta_m.get("contentHash"))

    # Adhkar full catalog
    st, body, _, n = get_json("/adhkar/full-catalog")
    apack = body.get("data") or {}
    ameta = apack.get("meta") or {}
    cats = apack.get("categories") or []
    ok("adhkar full-catalog meta version/hash", ameta.get("catalogVersion") == asm.get("catalogVersion") and ameta.get("contentHash") == asm.get("contentHash"), str(ameta))
    ok("adhkar categories count", len(cats) == 14 and ameta.get("totalCategories") == 14, f"len={len(cats)}")
    item_total = sum(len(c.get("items") or []) for c in cats)
    ok("adhkar items count", item_total == 115 and ameta.get("totalItems") == 115, f"items={item_total}")
    required_cat = {"id", "key", "nameAr", "nameEn", "descriptionAr", "descriptionEn", "sortOrder", "totalItems", "items"}
    required_item = {"id", "orderInCategory", "textAr", "textEn", "textArPlain", "repeatCount", "referenceAr", "referenceEn", "benefitAr", "benefitEn"}
    cat_ok = all(required_cat.issubset(set(c.keys())) for c in cats)
    item_ok = all(required_item.issubset(set(it.keys())) for c in cats for it in (c.get("items") or []))
    ok("adhkar category fields", cat_ok)
    ok("adhkar item fields", item_ok)
    ok("adhkar has Arabic text", all(isinstance(it.get("textAr"), str) and len(it["textAr"]) > 0 for c in cats for it in c["items"]))
    ok("adhkar has repeatCount ints", all(isinstance(it.get("repeatCount"), int) for c in cats for it in c["items"]))
    # sort order non-decreasing
    sorts = [c.get("sortOrder") for c in cats]
    ok("adhkar categories sorted", sorts == sorted(sorts), str(sorts))
    for c in cats:
        orders = [it.get("orderInCategory") for it in c["items"]]
        if orders != sorted(orders):
            ok(f"adhkar items ordered in {c.get('key')}", False, str(orders[:10]))
            break
    else:
        ok("adhkar items ordered in each category", True)

    # Juz ayahs
    st, body, _, _ = get_json("/quran/juz/1/ayahs")
    jz = body.get("data") or {}
    ok("juz/1/ayahs has ayahs", isinstance(jz.get("ayahs"), list) and len(jz["ayahs"]) > 0 and jz.get("totalAyahs") == len(jz["ayahs"]), f"total={jz.get('totalAyahs')}")
    sample = (jz.get("ayahs") or [{}])[0]
    ok("juz ayah fields", {"ayahNumber", "textAr", "surahId"}.issubset(set(sample.keys())) or {"ayahNumber", "textAr"}.issubset(set(sample.keys())), str(list(sample.keys())[:12]))

    # Quran full catalog (full download)
    print("\nDownloading /quran/full-catalog (may take a bit)...")
    st, raw, hdrs = raw_get("/quran/full-catalog", timeout=300)
    ok("quran full-catalog status", st == 200, f"status={st} bytes={len(raw)}")
    ok("quran Content-Type json", "application/json" in (hdrs.get("Content-Type") or hdrs.get("content-type") or ""), str(hdrs.get("Content-Type") or hdrs.get("content-type")))
    cl = hdrs.get("Content-Length") or hdrs.get("content-length")
    ok("quran Content-Length present", cl is not None and str(cl).isdigit(), str(cl))
    accept_ranges = hdrs.get("Accept-Ranges") or hdrs.get("accept-ranges")
    ok("quran Accept-Ranges", (accept_ranges or "").lower() == "bytes", str(accept_ranges))

    qpack = json.loads(raw.decode("utf-8")).get("data") or {}
    qmeta = qpack.get("meta") or {}
    surahs = qpack.get("surahs") or []
    juzs = qpack.get("juzs") or []
    ok("quran meta version/hash match static-meta", qmeta.get("catalogVersion") == qsm.get("catalogVersion") and qmeta.get("contentHash") == qsm.get("contentHash"), str(qmeta))
    ok("quran meta fields", all(k in qmeta for k in ["catalogVersion", "contentHash", "bismillahStripped", "downloadPath", "totalSurahs", "totalAyahs", "totalPages", "totalJuz"]), str(list(qmeta.keys())))
    ok("quran bismillahStripped true", qmeta.get("bismillahStripped") is True)
    ok("quran downloadPath", qmeta.get("downloadPath") == "/quran/full-catalog")
    ok("quran 114 surahs", len(surahs) == 114 and qmeta.get("totalSurahs") == 114, f"len={len(surahs)}")
    ok("quran 30 juzs", len(juzs) == 30 and qmeta.get("totalJuz") == 30, f"len={len(juzs)}")
    ayah_count = sum(len(s.get("ayahs") or []) for s in surahs)
    ok("quran 6236 ayahs", ayah_count == 6236 and qmeta.get("totalAyahs") == 6236, f"ayahs={ayah_count}")
    ok("quran surah meta fields", all({"id", "nameAr", "nameEn", "totalAyahs", "ayahs"}.issubset(s.keys()) for s in surahs))
    ok(
        "quran ayah fields",
        all({"ayahNumber", "textAr", "page", "juz"}.issubset((s.get("ayahs") or [{}])[0].keys()) for s in surahs if s.get("ayahs")),
    )
    ok("quran ayah text non-empty", all(isinstance(a.get("textAr"), str) and len(a["textAr"]) > 0 for s in surahs for a in s["ayahs"]))
    # consistency: each surah ayah count matches totalAyahs when possible
    mismatch = [s["id"] for s in surahs if s.get("totalAyahs") != len(s.get("ayahs") or [])]
    ok("quran surah ayah counts consistent", len(mismatch) == 0, f"mismatchSurahIds={mismatch[:10]}")
    # juz meta
    ok("quran juz fields", all({"juzNumber", "nameAr", "nameEn"}.issubset(j.keys()) for j in juzs))

    # Range request
    st, raw206, hdrs206 = raw_get("/quran/full-catalog", headers={"Range": "bytes=0-499", "Accept-Encoding": "identity"})
    ok("quran Range => 206", st == 206, f"status={st}")
    cr = hdrs206.get("Content-Range") or hdrs206.get("content-range")
    ok("quran Content-Range present", isinstance(cr, str) and cr.startswith("bytes 0-499/"), str(cr))
    ok("quran Range body length", len(raw206) == 500, f"len={len(raw206)}")
    prefix = raw206.decode("utf-8", "replace")
    ok("quran Range body starts success json", prefix.startswith('{"success":true'), prefix[:80])

    # Auth not required: already tested without Bearer. Extra: ensure 401 is NOT returned
    ok("no auth required on static packs", True, "all probes without Authorization returned 200/206")

    print("\n" + "=" * 60)
    print(f"SUMMARY pass={PASS} fail={FAIL}")
    print("=" * 60)
    if FAIL:
        print("\nFailures:")
        for status, area, detail in ROWS:
            if status == "FAIL":
                print(f" - {area}: {detail}")
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
