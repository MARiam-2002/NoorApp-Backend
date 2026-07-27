const path = require("node:path");

let cachedApp = null;

module.exports = async (req, res) => {
  try {
    if (!cachedApp) {
      const mod = require(path.join(__dirname, "..", "dist", "app.js"));
      const factory = mod.createApp || mod.default || mod;
      cachedApp = factory();
    }
    return cachedApp(req, res);
  } catch (err) {
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      JSON.stringify(
        {
          success: false,
          message: err && err.message ? err.message : "Startup error",
          error_code: "STARTUP_FAILED",
          hint: "فتحي Vercel Dashboard → Settings → Environment Variables وتأكدي من وجود (DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production)",
          stack:
            process.env.NODE_ENV === "production"
              ? undefined
              : err && err.stack,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return;
  }
};
