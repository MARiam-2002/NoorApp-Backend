/**
 * Rebuild the verified Sahihayn Daily Hadith bank from local Arabic editions.
 *
 * Prerequisites (not committed — download once):
 *   prisma/data/hadith/ara-bukhari.json
 *   prisma/data/hadith/ara-muslim.json
 * from: https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/
 *
 * Usage: python scripts/build-verified-hadith-bank.py
 */
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "prisma" / "data" / "hadith"
OUT = ROOT / "src" / "shared" / "data" / "verified-sahih-hadith-bank.json"

QUOTE_RE = re.compile(r'‏\s*"‏\s*(.*?)\s*‏"‏', re.S)
ALT_QUOTE_RE = re.compile(r'"\s*‏\s*(.*?)\s*‏\s*"', re.S)
TASHKEEL = re.compile(r"[\u064B-\u065F\u0670\u0640]")


def normalize(t: str) -> str:
    t = unicodedata.normalize("NFKC", t)
    t = TASHKEEL.sub("", t)
    return re.sub(r"\s+", " ", t).strip()


def extract_matns(text: str) -> list[str]:
    mats: list[str] = []
    for rx in (QUOTE_RE, ALT_QUOTE_RE):
        for m in rx.findall(text or ""):
            s = re.sub(r"\s+", " ", m).strip(" .‏،,")
            if s:
                mats.append(s)
    return mats


def is_ui_quality(matn: str) -> bool:
    n = normalize(matn)
    if not (45 <= len(n) <= 240):
        return False
    if "حدثنا" in n or "حدثني" in n or "أخبرنا" in n:
        return False
    if "حَدَّثَنَا" in matn or "حَدَّثَنِي" in matn:
        return False
    if n.count(" ") < 3:
        return False
    return True


def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return a


def pick_step(n: int) -> int:
    for cand in (
        997, 991, 983, 977, 971, 967, 953, 947, 941, 937, 929,
        487, 389, 281, 173, 97, 53, 41, 29, 17, 13, 11, 7, 5, 3,
    ):
        if cand < n and gcd(cand, n) == 1:
            return cand
    for cand in range(2, n):
        if gcd(cand, n) == 1:
            return cand
    return 1


def main() -> None:
    collections = [
        ("ara-bukhari", "bukhari", "صحيح البخاري", "رواه البخاري"),
        ("ara-muslim", "muslim", "صحيح مسلم", "رواه مسلم"),
    ]
    raw: list[dict] = []
    seen: set[str] = set()

    for fname, coll, collection_ar, short_ar in collections:
        path = SRC_DIR / f"{fname}.json"
        if not path.exists():
            raise SystemExit(f"Missing {path} — download ara-bukhari/ara-muslim editions first")
        hs = json.loads(path.read_text(encoding="utf-8"))["hadiths"]
        for h in hs:
            num = h.get("hadithnumber")
            matns = [m for m in extract_matns(h.get("text") or "") if is_ui_quality(m)]
            if not matns:
                continue
            matn = max(matns, key=lambda m: len(normalize(m)))
            key = normalize(matn)
            if key in seen:
                continue
            seen.add(key)
            ref = h.get("reference") or {}
            raw.append(
                {
                    "collection": coll,
                    "collectionAr": collection_ar,
                    "hadithNumber": int(num) if num is not None else None,
                    "book": ref.get("book"),
                    "bookHadith": ref.get("hadith"),
                    "textAr": matn,
                    "sourceAr": f"{short_ar} — رقم {num}",
                }
            )

    buk = [h for h in raw if h["collection"] == "bukhari"]
    mus = [h for h in raw if h["collection"] == "muslim"]
    interleaved: list[dict] = []
    i = j = 0
    while i < len(buk) or j < len(mus):
        if i < len(buk):
            interleaved.append(buk[i])
            i += 1
        if j < len(mus):
            interleaved.append(mus[j])
            j += 1

    n = len(interleaved)
    step = pick_step(n)
    bank = {
        "version": 2,
        "policy": {
            "qualityOverQuantity": True,
            "collectionsAllowed": ["Sahih al-Bukhari", "Sahih Muslim"],
            "collectionsExcluded": [
                "Jami at-Tirmidhi",
                "Sunan Abu Dawud",
                "unverified websites",
                "social media",
            ],
            "authenticityBasis": (
                "Only matn extracted from Arabic editions of Sahih al-Bukhari and Sahih Muslim "
                "(al-Sahihayn). Classical Ahl al-Sunnah scholarly consensus treats these two "
                "works as authentic (sahih) collections. No other collections are included."
            ),
            "editionSource": "fawazahmed0/hadith-api@1 Arabic editions (sunnah.com-derived Sahihayn texts)",
            "matnExtraction": (
                "Quoted Arabic prophetic segments with UI length filters; "
                "isnad leftovers rejected; undiacritized-text dedupe"
            ),
        },
        "count": n,
        "step": step,
        "yearStride": 17,
        "hadiths": interleaved,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(bank, ensure_ascii=False), encoding="utf-8")
    print(f"Wrote {OUT} count={n} buk={len(buk)} mus={len(mus)} step={step}")


if __name__ == "__main__":
    main()
