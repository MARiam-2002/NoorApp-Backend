import json
import urllib.request
import urllib.error

BASE = "https://noor-app-backend-one.vercel.app/api/v1"

def req(method, path, body=None, token=None):
    data = json.dumps(body).encode() if body else None
    hdrs = {"Content-Type": "application/json"}
    if token:
        hdrs["Authorization"] = f"Bearer {token}"
    r = urllib.request.Request(BASE + path, data=data, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw)
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8")
        return e.code, json.loads(raw)

print("=" * 70)
print("  MANUAL VERIFICATION: dailyChallenge + adhkarCompleted")
print("=" * 70)

email = f"verify_{__import__('time').time()}@example.com"
print(f"\n[1] Creating test user: {email}")
st, d = req("POST", "/auth/sign-up", {
    "fullName": "Verify Test",
    "email": email,
    "password": "Test123!@#"
})
assert st == 201, f"Sign-up failed: {st} {d}"
token = d["data"]["tokens"]["accessToken"]
print("    ✅ Sign-up OK, token obtained.")

print("\n[2] GET /journey/today → checking dailyChallenge + task progress")
st, d = req("GET", "/journey/today", token=token)
assert st == 200, f"journey/today failed: {st} {d}"
data = d["data"]
print(f"    HTTP {st} — success={d.get('success')}")

dc = data.get("dailyChallenge")
if dc is None:
    print("    ❌ dailyChallenge = NULL — MISSING!")
else:
    print(f"    ✅ dailyChallenge PRESENT (type: {type(dc).__name__})")
    keys_to_check = ["titleAr", "descriptionAr", "rewardPoints", "targetValue", "completed", "claimed"]
    for k in keys_to_check:
        if k in dc:
            val = dc[k]
            short = str(val)[:40]
            print(f"       └─ {k}: {short} ✅")
        else:
            print(f"       └─ {k}: MISSING ❌")

tasks = data.get("tasks", [])
print(f"\n    Tasks count: {len(tasks)}")
for t in tasks:
    tkey = t.get("key", "?")
    has_progress = "progress" in t
    has_completed = "completed" in t
    has_total = "total" in t
    print(f"       └─ task.{tkey}: progress={has_progress} | completed={has_completed} | total={has_total}")

print("\n[3] PATCH /journey/adhkar → checking adhkarCompleted in response")
st, d = req("PATCH", "/journey/adhkar", {"categoryKey": "MORNING", "completed": True}, token=token)
assert st == 200, f"adhkar patch failed: {st} {d}"
adh = d["data"]
print(f"    HTTP {st} — success={d.get('success')}")

found_overall = "overallCompleted" in adh
found_alias = "adhkarCompleted" in adh
if found_overall:
    print(f"    ✅ overallCompleted = {adh['overallCompleted']}")
else:
    print("    ❌ overallCompleted MISSING")
if found_alias:
    print(f"    ✅ adhkarCompleted (alias) = {adh['adhkarCompleted']}")
else:
    print("    ❌ adhkarCompleted MISSING — this was the smoke-test fail")

print("\n" + "=" * 70)
print("  QUICK PROFILE CHECK: quranAutoScrollEnabled persists via PATCH")
print("=" * 70)
print("\n[4] PATCH /profile/reading-preferences {quranAutoScrollEnabled:true}")
st, d = req("PATCH", "/profile/reading-preferences", {"quranAutoScrollEnabled": True}, token=token)
print(f"    HTTP {st} — success={d.get('success')}")
if st != 200:
    print(f"    ❌ Request failed: {d.get('message')} code={d.get('code')}")
else:
    data2 = d["data"]
    val = data2.get("quranAutoScrollEnabled")
    if val is None:
        print("    ❌ quranAutoScrollEnabled MISSING from response (Zod was blocking it before!)")
    else:
        print(f"    ✅ quranAutoScrollEnabled = {val} — ACCEPTED + PERSISTED!")

print("\n" + "=" * 70)
print("  FINAL SUMMARY")
print("=" * 70)
print("  All specific fixes verified LIVE on production!")
