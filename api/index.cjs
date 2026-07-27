"use strict";
const path = require("node:path");

let cachedApp = null;
let bootError = null;

module.exports = async function handler(req, res) {
  try {
    if (!cachedApp && !bootError) {
      const mod = require(path.join(__dirname, "..", "dist", "app.js"));
      const factory = mod.createApp || mod.default || mod;
      cachedApp = factory();
    }
    if (bootError) throw bootError;
    return cachedApp(req, res);
  } catch (err) {
    bootError = err;
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.end(
      JSON.stringify(
        {
          success: false,
          message: (err && err.message) || "Startup failed",
          error_code: "STARTUP_FAILED",
          hint: "افتحي Vercel → Settings → Environment Variables. ضروري تكون موجودة ومفعلة على Production: DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production",
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
    return;
  }
};
