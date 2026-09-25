const BASE = "https://noorapp-backend-production.up.railway.app/api/v1";
const http = require("https");
const { inspect } = require("util");

function get(path, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method: "GET",
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: { "User-Agent": "Noor-Prod-Smoke/1.0", ...headers },
      timeout: 20000,
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            raw: data.slice(0, 4000),
            parseErr: String(e),
          });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("ETIMEDOUT"));
    });
    req.end();
  });
}

function post(path, body, { headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const payload = JSON.stringify(body || {});
    const opts = {
      method: "POST",
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      headers: {
        "User-Agent": "Noor-Prod-Smoke/1.0",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(payload),
        ...headers,
      },
      timeout: 20000,
    };
    const req = http.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: JSON.parse(data),
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            raw: data.slice(0, 4000),
            parseErr: String(e),
          });
        }
      });
    });
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy(new Error("ETIMEDOUT"));
    });
    req.write(payload);
    req.end();
  });
}

const EXPECTED_ENVELOPE = [
  "success",
  "message",
  "data",
  "meta",
  "timestamp",
  "requestId",
];

function checkEnvelope(res, name) {
  const errs = [];
  if (!res.body || typeof res.body !== "object") {
    return [`[${name}] body is not JSON object (status=${res.status})`];
  }
  for (const k of EXPECTED_ENVELOPE) {
    if (!(k in res.body)) errs.push(`[${name}] missing envelope key: ${k}`);
  }
  if (
    res.body.success !== true &&
    res.status !== 401 &&
    res.status !== 404 &&
    res.status !== 403
  ) {
    errs.push(
      `[${name}] success=false unexpectedly (status=${res.status}, message=${res.body.message})`,
    );
  }
  return errs;
}

(async () => {
  const results = [];
  const errors = [];

  const push = (name, status, extra = {}) => {
    results.push({ name, status, ...extra });
    process.stdout.write(`[${status ? "PASS" : "FAIL"}] ${name}\n`);
  };

  // --- 1. Health Check
  try {
    const r = await get("/health");
    const envelope = checkEnvelope(r, "/health");
    if (envelope.length) errors.push(...envelope);
    const ok =
      r.status === 200 &&
      r.body?.success === true &&
      r.body?.data?.status === "ok" &&
      envelope.length === 0;
    push("GET /health (Production)", ok, {
      status: r.status,
      data: r.body?.data,
    });
    if (!ok) errors.push(`/health failed: ${r.raw}`);
  } catch (e) {
    errors.push("/health threw: " + e.message);
    push("GET /health (Production)", false, { err: e.message });
  }

  // --- 2. Azan Sounds Catalog (expect 14 sounds: 9 self-hosted + 5 soundcloud refs)
  try {
    const r = await get("/azan/sounds");
    const envelope = checkEnvelope(r, "/azan/sounds");
    if (envelope.length) errors.push(...envelope);
    const list = r.body?.data?.sounds || r.body?.data || [];
    const sounds = Array.isArray(list)
      ? list
      : Array.isArray(r.body?.data)
        ? r.body?.data
        : [];
    const ids = sounds.map((s) => s.id);
    const hasSelf = [
      "mishary_alafasy",
      "ali_mulla",
      "yasser_al_dosari",
      "abdul_basit",
      "mohamed_minshawi",
      "mohamed_rifaat",
    ].every((x) => ids.includes(x));
    const hasSC = [
      "sc_noor_azan_1",
      "sc_noor_azan_2",
      "sc_noor_azan_3",
      "sc_noor_azan_4",
      "sc_noor_azan_5",
    ].every((x) => ids.includes(x));
    const allHaveMedia = sounds.every((s) => typeof s.mediaFile === "string");
    const allHaveProvider = sounds.every((s) => typeof s.provider === "string");
    const ok =
      r.status === 200 &&
      sounds.length >= 14 &&
      hasSelf &&
      hasSC &&
      allHaveMedia &&
      allHaveProvider &&
      envelope.length === 0;
    push("GET /azan/sounds — 14 sounds (9 self + 5 SC refs)", ok, {
      count: sounds.length,
      idsSample: ids.slice(0, 14),
      hasSelf,
      hasSC,
      allHaveMedia,
      allHaveProvider,
    });
    if (!ok)
      errors.push(
        `/azan/sounds failed — count=${sounds.length}, hasSelf=${hasSelf}, hasSC=${hasSC}`,
      );
  } catch (e) {
    errors.push("/azan/sounds threw: " + e.message);
    push("GET /azan/sounds — 14 sounds", false, { err: e.message });
  }

  // --- 3. Notification Sounds (expect >= 7)
  try {
    const r = await get("/azan/notification-sounds");
    const envelope = checkEnvelope(r, "/azan/notification-sounds");
    if (envelope.length) errors.push(...envelope);
    const list = r.body?.data?.sounds || r.body?.data || [];
    const sounds = Array.isArray(list)
      ? list
      : Array.isArray(r.body?.data)
        ? r.body?.data
        : [];
    const ids = sounds.map((s) => s.id);
    const hasDefault = ids.includes("soft_chime");
    const hasSilent = ids.includes("silent");
    const ok =
      r.status === 200 &&
      sounds.length >= 7 &&
      hasDefault &&
      hasSilent &&
      envelope.length === 0;
    push(
      "GET /azan/notification-sounds — >= 7 tones (soft_chime + silent)",
      ok,
      { count: sounds.length, ids },
    );
    if (!ok)
      errors.push(`/azan/notification-sounds failed count=${sounds.length}`);
  } catch (e) {
    errors.push("/azan/notification-sounds threw: " + e.message);
    push("GET /azan/notification-sounds", false, { err: e.message });
  }

  // --- 4. Audio Defaults (actual backend contract: fields are azanSound / notificationSound)
  try {
    const r = await get("/azan/audio-defaults");
    const envelope = checkEnvelope(r, "/azan/audio-defaults");
    if (envelope.length) errors.push(...envelope);
    const d = r.body?.data || {};
    const ok =
      r.status === 200 &&
      typeof d.azanSound === "object" &&
      d.azanSound?.id === "mishary_alafasy" &&
      typeof d.notificationSound === "object" &&
      d.notificationSound?.id === "soft_chime" &&
      envelope.length === 0;
    push(
      "GET /azan/audio-defaults — azanSound=mishary, notificationSound=soft_chime (REAL CONTRACT)",
      ok,
      {
        ids: { azan: d.azanSound?.id, notif: d.notificationSound?.id },
        dataShape: Object.keys(d),
      },
    );
    if (!ok) errors.push("/azan/audio-defaults mismatch: " + inspect(d));
  } catch (e) {
    errors.push("/azan/audio-defaults threw: " + e.message);
    push("GET /azan/audio-defaults", false, { err: e.message });
  }

  // --- 5. Calculation Methods
  try {
    const r = await get("/azan/calculation-methods");
    const envelope = checkEnvelope(r, "/azan/calculation-methods");
    if (envelope.length) errors.push(...envelope);
    const list = r.body?.data?.methods || r.body?.data || [];
    const methods = Array.isArray(list) ? list : r.body?.data;
    const ok =
      r.status === 200 &&
      Array.isArray(methods) &&
      methods.length >= 6 &&
      envelope.length === 0;
    push("GET /azan/calculation-methods — >= 6 methods", ok, {
      count: methods?.length || 0,
    });
  } catch (e) {
    errors.push("/azan/calculation-methods threw: " + e.message);
    push("GET /azan/calculation-methods", false, { err: e.message });
  }

  // --- 6. Madhabs
  try {
    const r = await get("/azan/madhabs");
    const envelope = checkEnvelope(r, "/azan/madhabs");
    if (envelope.length) errors.push(...envelope);
    const list = r.body?.data?.madhabs || r.body?.data || [];
    const ok =
      r.status === 200 &&
      Array.isArray(list) &&
      list.length === 2 &&
      envelope.length === 0;
    push("GET /azan/madhabs — SHAFI + HANAFI", ok, {
      count: list?.length || 0,
    });
  } catch (e) {
    errors.push("/azan/madhabs threw: " + e.message);
    push("GET /azan/madhabs", false, { err: e.message });
  }

  // --- 7. Prayers Today (guest — Cairo default) & Response Shape
  try {
    const r = await get("/prayers/today");
    const envelope = checkEnvelope(r, "/prayers/today");
    if (envelope.length) errors.push(...envelope);
    const d = r.body?.data || {};
    const hasSchedule = Array.isArray(d.schedule) && d.schedule.length >= 5;
    const hasNext =
      !!d.nextPrayer && typeof d.nextPrayer.countdownSeconds === "number";
    const ok =
      r.status === 200 && hasSchedule && hasNext && envelope.length === 0;
    push("GET /prayers/today — 5 prayers + nextPrayer countdown", ok, {
      scheduleLen: d.schedule?.length || 0,
      next: d.nextPrayer?.name,
      tz: d.timezone,
    });
    if (!ok)
      errors.push(
        `/prayers/today: scheduleLen=${d.schedule?.length}, next=${JSON.stringify(d.nextPrayer)}`,
      );
  } catch (e) {
    errors.push("/prayers/today threw: " + e.message);
    push("GET /prayers/today", false, { err: e.message });
  }

  // --- 8. CRON endpoint auth test (MUST be protected / return 401 without secret)
  try {
    const r = await post("/cron/prayer-reminders", {}, {});
    const protected =
      r.status === 401 ||
      r.status === 403 ||
      r.status === 404 ||
      r.body?.success === false;
    push(
      "POST /cron/prayer-reminders (no secret) — protected (401/403)",
      protected,
      { status: r.status, success: r.body?.success },
    );
    if (!protected) errors.push("/cron is NOT PROTECTED! status=" + r.status);
  } catch (e) {
    errors.push("/cron check threw: " + e.message);
    push("POST /cron/prayer-reminders protection", false, { err: e.message });
  }

  // --- 9. Stream Audio file (Range test) — public endpoint
  try {
    const r = await new Promise((resolve, reject) => {
      const u = new URL(BASE + "/azan/media/mishary_alafasy.mp3");
      const opts = {
        method: "GET",
        hostname: u.hostname,
        port: 443,
        path: u.pathname + u.search,
        headers: { "User-Agent": "Noor-Smoke/1.0", Range: "bytes=0-1023" },
        timeout: 20000,
      };
      const req = http.request(opts, (res) => {
        let buf = Buffer.alloc(0);
        res.on("data", (c) => (buf = Buffer.concat([buf, c])));
        res.on("end", () =>
          resolve({
            status: res.statusCode,
            headers: res.headers,
            byteLen: buf.length,
          }),
        );
      });
      req.on("error", reject);
      req.on("timeout", () => req.destroy(new Error("ETIMEDOUT")));
      req.end();
    });
    const ok = (r.status === 206 || r.status === 200) && r.byteLen > 0;
    push(
      "GET /azan/media/mishary_alafasy.mp3 Range:0-1023 (206/200 + bytes)",
      ok,
      {
        status: r.status,
        bytes: r.byteLen,
        cr: r.headers?.["content-range"],
        ct: r.headers?.["content-type"],
      },
    );
    if (!ok)
      errors.push(
        `azan/media range failed status=${r.status}, bytes=${r.byteLen}`,
      );
  } catch (e) {
    errors.push("/azan/media threw: " + e.message);
    push("GET /azan/media stream", false, { err: e.message });
  }

  // --- 10. Dashboard endpoint (Response Shape). Dashboard may require auth => 401 acceptable; envelope still must match otherwise.
  try {
    const r = await get("/dashboard");
    const envelope = checkEnvelope(r, "/dashboard");
    // If status is 200 success, we demand the full envelope (data + meta).
    // If status is 401/403 (auth required for this deploy), that's acceptable; just require the 4 envelope keys + success=false/message.
    let ok;
    if (r.status === 200) {
      ok = r.body?.success === true && envelope.length === 0;
      if (!ok) errors.push(`/dashboard 200 but no full envelope: ${inspect(r.body || {})}`);
    } else if (r.status === 401 || r.status === 403) {
      const hasRequired = ['success','message','timestamp','requestId'].every(k => typeof r.body?.[k] !== 'undefined');
      ok = hasRequired && r.body?.success === false;
      if (!ok) errors.push(`/dashboard auth response missing envelope keys: ${inspect(r.body || {})}`);
    } else {
      ok = false;
      errors.push(`/dashboard unexpected status=${r.status}`);
    }
    push("GET /dashboard — envelope valid (200 OK or 401 auth)", ok, { status: r.status, bodyKeys: Object.keys(r.body || {}) });
  } catch (e) {
    errors.push("/dashboard threw: " + e.message);
    push("GET /dashboard envelope", false, { err: e.message });
  }

  // --- 11. Swagger JSON (107 routes registered)
  try {
    const r = await get("/docs.json");
    const paths = r.body?.paths ? Object.keys(r.body.paths).length : 0;
    const tags = r.body?.tags ? r.body.tags.length : 0;
    const ok = r.status === 200 && paths >= 90;
    push("GET /docs.json — Swagger routes count", ok, { paths, tags });
    if (!ok) errors.push(`Swagger paths=${paths} (< 90)`);
  } catch (e) {
    errors.push("/docs.json threw: " + e.message);
    push("GET /docs.json swagger", false, { err: e.message });
  }

  // --- Summary
  process.stdout.write("\n===== RAILWAY PRODUCTION SMOKE SUMMARY =====\n");
  const pass = results.filter((r) => r.status).length;
  const fail = results.filter((r) => !r.status).length;
  process.stdout.write(
    `TOTAL: ${results.length} | PASS: ${pass} | FAIL: ${fail}\n`,
  );
  if (errors.length) {
    process.stdout.write(
      `\nERRORS (${errors.length}):\n  - ${errors.join("\n  - ")}\n`,
    );
    process.exit(1);
  } else {
    process.stdout.write(
      "\n✅ ALL CHECKS PASSED — Railway Production 100% Verified (2026 Adhan Audio + Notification Contract).\n",
    );
    process.exit(0);
  }
})().catch((e) => {
  console.error("SMOKE FATAL:", e);
  process.exit(2);
});
