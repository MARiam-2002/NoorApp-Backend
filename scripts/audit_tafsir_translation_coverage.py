#!/usr/bin/env python3
"""
Fast local coverage audit for Noor tafsirs + translations.
Same upstream resource IDs as Backend. Respects 429 / Retry-After.
Does not hammer Noor Production.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "audit-reports"
OUT.mkdir(exist_ok=True)

TAFSIRS = [
    {"id": "Ibn_Kathir", "resourceId": 14, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Al_Tabari", "resourceId": 15, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Al_Qurtubi", "resourceId": 90, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Ibn_Kathir_Muyassar", "resourceId": 16, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Al_Baghawi", "resourceId": 94, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Al_Saadi", "resourceId": 91, "language": "Arabic", "provider": "quran_foundation"},
    {"id": "Ibn_Kathir_En", "resourceId": 169, "language": "English", "provider": "quran_foundation"},
]

TRANSLATIONS = [
    {"id": "Sahih_International", "resourceId": 20, "language": "English", "provider": "quran_foundation"},
    {"id": "Yusuf_Ali", "resourceId": 22, "language": "English", "provider": "quran_foundation"},
    {"id": "Pickthall", "resourceId": 19, "language": "English", "provider": "quran_foundation"},
    {"id": "French_Hamidullah", "resourceId": 31, "language": "French", "provider": "quran_foundation"},
    {"id": "Turkish_Diyanet", "resourceId": 77, "language": "Turkish", "provider": "quran_foundation"},
    {"id": "Malay_Basmeih", "resourceId": 39, "language": "Malay", "provider": "quran_foundation"},
    {"id": "Indonesian_Depag", "resourceId": 33, "language": "Indonesian", "provider": "quran_foundation"},
]

BASE = "https://api.quran.com/api/v4"
QUL_CDN = "https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/ar-tafseer-al-qurtubi"


def http_get_json(url: str, retries: int = 8) -> dict | list:
    last = None
    for i in range(retries):
        try:
            req = urllib.request.Request(
                url,
                headers={"Accept": "application/json", "User-Agent": "NoorCoverageAudit/1.0"},
            )
            with urllib.request.urlopen(req, timeout=90) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            last = e
            if e.code == 429:
                ra = e.headers.get("Retry-After")
                wait = int(ra) if ra and str(ra).isdigit() else min(60, 2 ** (i + 1))
                print(f"  429 wait {wait}s", flush=True)
                time.sleep(wait)
                continue
            if e.code in (502, 503, 504):
                time.sleep(min(30, 2 ** (i + 1)))
                continue
            raise
        except Exception as e:
            last = e
            time.sleep(min(15, 1.5 * (i + 1)))
    raise last  # type: ignore


def load_chapters() -> dict[int, int]:
    data = http_get_json(f"{BASE}/chapters?language=en")
    assert isinstance(data, dict)
    return {int(c["id"]): int(c["verses_count"]) for c in data["chapters"]}


def sample_ayahs(verses_count: int) -> list[int]:
    if verses_count <= 3:
        return list(range(1, verses_count + 1))
    mid = max(1, verses_count // 2)
    return sorted({1, mid, verses_count})


def tafsir_chapter_coverage(resource_id: int, chapter: int, expected: int) -> tuple[int, set[str], int, bool]:
    """
    Returns (total_records, covered_keys, empty_row_count, assumed_full).
    If total_records == expected, assumed_full=True and keys may be partial (page 1 only).
    """
    url = f"{BASE}/tafsirs/{resource_id}/by_chapter/{chapter}?per_page=50&page=1"
    data = http_get_json(url)
    assert isinstance(data, dict)
    rows = data.get("tafsirs") or []
    pag = data.get("pagination") or {}
    total_records = int(pag.get("total_records") or len(rows))
    keys: set[str] = set()
    empty = 0
    for row in rows:
        vk = row.get("verse_key")
        if isinstance(vk, str):
            keys.add(vk)
        if not (row.get("text") or "").strip():
            empty += 1

    if total_records == expected and expected > 0:
        return total_records, keys, empty, True

    page = pag.get("next_page")
    while page:
        time.sleep(0.08)
        data = http_get_json(
            f"{BASE}/tafsirs/{resource_id}/by_chapter/{chapter}?per_page=50&page={int(page)}"
        )
        assert isinstance(data, dict)
        rows = data.get("tafsirs") or []
        pag = data.get("pagination") or {}
        for row in rows:
            vk = row.get("verse_key")
            if isinstance(vk, str):
                keys.add(vk)
            if not (row.get("text") or "").strip():
                empty += 1
        page = pag.get("next_page")
    return total_records, keys, empty, False


def audit_tafsir(t: dict, chapters: dict[int, int]) -> dict:
    catalog_id = t["id"]
    rid = t["resourceId"]
    missing_surahs: list[int] = []
    missing_ayahs: list[str] = []
    empty_rows = 0
    wrong_resource: list[str] = []
    covered_surahs = 0
    ayahs_covered = 0
    sample_checks: list[dict] = []

    print(f"Auditing tafsir {catalog_id} ({rid})…", flush=True)
    for surah in range(1, 115):
        expected = chapters[surah]
        time.sleep(0.1)
        try:
            total_records, keys, empty, assumed_full = tafsir_chapter_coverage(rid, surah, expected)
        except Exception as e:
            print(f"  ERROR {catalog_id} {surah}: {e}", flush=True)
            missing_surahs.append(surah)
            missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
            continue

        empty_rows += empty
        if total_records <= 0:
            missing_surahs.append(surah)
            missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
        elif assumed_full:
            covered_surahs += 1
            ayahs_covered += expected
        else:
            covered_surahs += 1
            for a in range(1, expected + 1):
                key = f"{surah}:{a}"
                if key in keys:
                    ayahs_covered += 1
                else:
                    missing_ayahs.append(key)

        if surah in (1, 2, 18, 36, 55, 112, 114):
            for a in sample_ayahs(expected):
                time.sleep(0.08)
                try:
                    d = http_get_json(f"{BASE}/tafsirs/{rid}/by_ayah/{surah}:{a}")
                    assert isinstance(d, dict)
                    tf = d.get("tafsir") or {}
                    text = (tf.get("text") or "").strip()
                    got_rid = tf.get("resource_id")
                    ok = bool(text) and (got_rid is None or int(got_rid) == rid)
                    if got_rid is not None and int(got_rid) != rid:
                        wrong_resource.append(f"{surah}:{a} got {got_rid}")
                    sample_checks.append(
                        {"verse": f"{surah}:{a}", "ok": ok, "textLen": len(text), "resource_id": got_rid}
                    )
                except Exception as e:
                    sample_checks.append({"verse": f"{surah}:{a}", "ok": False, "error": str(e)[:120]})

        if surah % 19 == 0:
            print(f"  {catalog_id}: through surah {surah}", flush=True)

    total = sum(chapters.values())
    if covered_surahs == 114 and not missing_ayahs and empty_rows == 0:
        status = "FULL"
    elif covered_surahs == 0:
        status = "EMPTY"
    else:
        status = "PARTIAL"

    return {
        "kind": "tafsir",
        "id": catalog_id,
        "resourceId": rid,
        "language": t["language"],
        "provider": t["provider"],
        "surahsCovered": covered_surahs,
        "missingSurahs": missing_surahs,
        "missingAyahsCount": len(missing_ayahs),
        "missingAyahsSample": missing_ayahs[:50],
        "emptyRowCount": empty_rows,
        "wrongResourceSamples": wrong_resource[:20],
        "ayahsCovered": ayahs_covered,
        "ayahsExpected": total,
        "coveragePercent": round(100.0 * ayahs_covered / total, 2),
        "status": status,
        "sampleChecks": sample_checks,
    }


def audit_translation(t: dict, chapters: dict[int, int]) -> dict:
    catalog_id = t["id"]
    rid = t["resourceId"]
    missing_surahs: list[int] = []
    missing_ayahs: list[str] = []
    empty_ayahs: list[str] = []
    wrong_resource: list[str] = []
    covered_surahs = 0
    ayahs_covered = 0
    sample_checks: list[dict] = []

    print(f"Auditing translation {catalog_id} ({rid})…", flush=True)
    for surah in range(1, 115):
        expected = chapters[surah]
        time.sleep(0.12)
        try:
            data = http_get_json(f"{BASE}/quran/translations/{rid}?chapter_number={surah}")
            assert isinstance(data, dict)
            rows = data.get("translations") or []
        except Exception as e:
            print(f"  ERROR {catalog_id} {surah}: {e}", flush=True)
            missing_surahs.append(surah)
            missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
            continue

        if not rows:
            missing_surahs.append(surah)
            missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
        else:
            covered_surahs += 1
            for a in range(1, expected + 1):
                if a <= len(rows):
                    row = rows[a - 1]
                    text = (row.get("text") or "").strip()
                    got_rid = row.get("resource_id")
                    if got_rid is not None and int(got_rid) != rid:
                        wrong_resource.append(f"{surah}:{a} got {got_rid}")
                    if not text:
                        empty_ayahs.append(f"{surah}:{a}")
                        missing_ayahs.append(f"{surah}:{a}")
                    else:
                        ayahs_covered += 1
                else:
                    missing_ayahs.append(f"{surah}:{a}")

        if surah in (1, 2, 18, 36, 55, 112, 114) and rows:
            for a in sample_ayahs(expected):
                if a <= len(rows):
                    text = (rows[a - 1].get("text") or "").strip()
                    got_rid = rows[a - 1].get("resource_id")
                    sample_checks.append(
                        {
                            "verse": f"{surah}:{a}",
                            "ok": bool(text) and (got_rid is None or int(got_rid) == rid),
                            "textLen": len(text),
                            "resource_id": got_rid,
                        }
                    )

        if surah % 19 == 0:
            print(f"  {catalog_id}: through surah {surah}", flush=True)

    total = sum(chapters.values())
    if covered_surahs == 114 and not missing_ayahs and not empty_ayahs:
        status = "FULL"
    elif covered_surahs == 0:
        status = "EMPTY"
    else:
        status = "PARTIAL"

    return {
        "kind": "translation",
        "id": catalog_id,
        "resourceId": rid,
        "language": t["language"],
        "provider": t["provider"],
        "surahsCovered": covered_surahs,
        "missingSurahs": missing_surahs,
        "missingAyahsCount": len(missing_ayahs),
        "missingAyahsSample": missing_ayahs[:50],
        "emptyAyahsCount": len(empty_ayahs),
        "wrongResourceSamples": wrong_resource[:20],
        "ayahsCovered": ayahs_covered,
        "ayahsExpected": total,
        "coveragePercent": round(100.0 * ayahs_covered / total, 2),
        "status": status,
        "sampleChecks": sample_checks,
    }


def audit_qul(chapters: dict[int, int]) -> dict:
    print("Auditing Al_Qurtubi QUL resource 23…", flush=True)
    missing_surahs: list[int] = []
    missing_ayahs: list[str] = []
    empty_ayahs: list[str] = []
    covered_surahs = 0
    ayahs_covered = 0
    for surah in range(1, 115):
        expected = chapters[surah]
        time.sleep(0.08)
        try:
            rows = http_get_json(f"{QUL_CDN}/{surah}.json")
            if not isinstance(rows, list) or not rows:
                missing_surahs.append(surah)
                missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
                continue
            by_ayah = {
                int(r["ayah"]): (r.get("text") or "").strip()
                for r in rows
                if isinstance(r, dict) and "ayah" in r
            }
            covered_surahs += 1
            for a in range(1, expected + 1):
                text = by_ayah.get(a)
                if text is None:
                    missing_ayahs.append(f"{surah}:{a}")
                elif not text:
                    empty_ayahs.append(f"{surah}:{a}")
                else:
                    ayahs_covered += 1
        except Exception as e:
            print(f"  QUL ERROR {surah}: {e}", flush=True)
            missing_surahs.append(surah)
            missing_ayahs.extend(f"{surah}:{a}" for a in range(1, expected + 1))
        if surah % 19 == 0:
            print(f"  QUL: through surah {surah}", flush=True)

    total = sum(chapters.values())
    status = (
        "FULL"
        if covered_surahs == 114 and not missing_ayahs and not empty_ayahs
        else ("EMPTY" if covered_surahs == 0 else "PARTIAL")
    )
    return {
        "kind": "tafsir",
        "id": "Al_Qurtubi_QUL23",
        "resourceId": 23,
        "language": "Arabic",
        "provider": "qul",
        "surahsCovered": covered_surahs,
        "missingSurahs": missing_surahs,
        "missingAyahsCount": len(missing_ayahs),
        "missingAyahsSample": missing_ayahs[:50],
        "emptyAyahsCount": len(empty_ayahs),
        "wrongResourceSamples": [],
        "ayahsCovered": ayahs_covered,
        "ayahsExpected": total,
        "coveragePercent": round(100.0 * ayahs_covered / total, 2),
        "status": status,
        "note": "Preferred Backend source for catalog Al_Qurtubi",
    }


def write_report(results: list[dict]) -> None:
    report = {
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "method": "Local upstream audit (api.quran.com + QUL CDN) using Backend catalog resource IDs",
        "results": results,
    }
    (OUT / "tafsir_translation_coverage_2026.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    lines = [
        "# Tafsir & Translation Coverage Audit — 2026",
        "",
        f"Generated: {report['generatedAt']}",
        "",
        "| Resource | Provider | Language | Surahs Covered | Missing Surahs | Missing Ayahs | Status |",
        "| -------- | -------- | -------- | -------------: | -------------- | ------------- | ------ |",
    ]
    for r in results:
        miss_s = ",".join(str(x) for x in r.get("missingSurahs", [])[:20]) or "—"
        if len(r.get("missingSurahs", [])) > 20:
            miss_s += f"…(+{len(r['missingSurahs']) - 20})"
        lines.append(
            f"| {r['id']} ({r['resourceId']}) | {r['provider']} | {r['language']} | "
            f"{r['surahsCovered']}/114 | {miss_s} | {r['missingAyahsCount']} | {r['status']} |"
        )
    (OUT / "TAFSIR_TRANSLATION_COVERAGE_AUDIT_2026.md").write_text(
        "\n".join(lines) + "\n", encoding="utf-8"
    )


def main() -> None:
    print("Loading chapters…", flush=True)
    chapters = load_chapters()
    print(f"Ayahs expected: {sum(chapters.values())}", flush=True)
    results: list[dict] = []
    for t in TAFSIRS:
        results.append(audit_tafsir(t, chapters))
        print(
            f"  -> {results[-1]['status']} {results[-1]['coveragePercent']}% "
            f"missingAyahs={results[-1]['missingAyahsCount']}",
            flush=True,
        )
    results.append(audit_qul(chapters))
    print(f"  -> {results[-1]['status']} {results[-1]['coveragePercent']}%", flush=True)
    for t in TRANSLATIONS:
        results.append(audit_translation(t, chapters))
        print(
            f"  -> {results[-1]['status']} {results[-1]['coveragePercent']}% "
            f"missingAyahs={results[-1]['missingAyahsCount']}",
            flush=True,
        )
    write_report(results)
    print("Wrote audit-reports/tafsir_translation_coverage_2026.json", flush=True)
    print("Wrote audit-reports/TAFSIR_TRANSLATION_COVERAGE_AUDIT_2026.md", flush=True)


if __name__ == "__main__":
    main()
