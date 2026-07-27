let app;
let initError = null;
let initPromise = null;

async function initAppOnce() {
  if (app) return app;
  if (initError) throw initError;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const path = require("node:path");
      const mod = require(path.join(__dirname, "..", "dist", "app.js"));
      const factory = mod.createApp || mod.default || mod;
      if (typeof factory !== "function") {
        throw new Error(
          "Invalid app export from dist/app.js — expected createApp function",
        );
      }
      app = await Promise.resolve().then(() => factory());
      if (!app || typeof app.handle !== "function") {
        throw new Error("createApp() did not return a valid Express app");
      }
      return app;
    } catch (err) {
      initError = err;
      throw err;
    }
  })();
  return initPromise;
}

function buildErrorResponse(err, statusCode = 500) {
  const msg = err && err.message ? String(err.message) : "Unknown server error";
  const stack = err && err.stack ? String(err.stack) : undefined;
  const payload = {
    success: false,
    message: msg,
    error: {
      code:
        (err && err.code) ||
        (statusCode === 500 ? "SERVER_ERROR" : "REQUEST_ERROR"),
      ...(process.env.NODE_ENV !== "production" && stack ? { stack } : {}),
    },
    meta: {
      hint:
        statusCode === 500
          ? "Check Environment Variables in Vercel Dashboard (DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, NODE_ENV)"
          : undefined,
      timestamp: new Date().toISOString(),
    },
  };
  return { statusCode, payload };
}

module.exports = async (req, res) => {
  try {
    const instance = await initAppOnce();
    return instance(req, res);
  } catch (err) {
    const { statusCode, payload } = buildErrorResponse(err, 500);
    res.statusCode = statusCode;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "no-store, no-cache, must-revalidate, proxy-revalidate",
    );
    res.end(JSON.stringify(payload, null, 2));
    return;
  }
};
