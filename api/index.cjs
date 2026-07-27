'use strict';
const path = require('node:path');

let cachedApp = null;
let bootError = null;

function jsonResponse(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.end(JSON.stringify(body, null, 2));
}

module.exports = async function handler(req, res) {
  const watchdog = setTimeout(() => {
    jsonResponse(res, 504, {
      success: false,
      message: bootError
        ? 'تأخر بدء التشغيل بسبب خطأ: ' + String(bootError.message || bootError)
        : 'تأخر بدء التشغيل — تحقق من الـ Environment Variables في Vercel Dashboard',
      error_code: 'STARTUP_TIMEOUT',
      hint_arabic:
        'الخطوة الأهم: افتحي Vercel → Settings → Environment Variables وتأكدي من وجود 4 متغيرات: DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production',
      hint:
        'Open Vercel Dashboard → Settings → Environment Variables and confirm these 4 exist: DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production',
      timestamp: new Date().toISOString(),
    });
  }, 4500);

  try {
    if (!cachedApp && !bootError) {
      const appPath = path.join(__dirname, '..', 'dist', 'app.js');
      const mod = require(appPath);
      const factory = mod.createApp || mod.default || mod;
      if (typeof factory !== 'function') {
        throw new Error('createApp function missing in dist/app.js');
      }
      cachedApp = factory();
      if (!cachedApp || typeof cachedApp.handle !== 'function') {
        throw new Error('Express app not returned from createApp');
      }
    }
    if (bootError) throw bootError;
    clearTimeout(watchdog);
    return cachedApp(req, res);
  } catch (err) {
    bootError = err;
    clearTimeout(watchdog);
    jsonResponse(res, 500, {
      success: false,
      message: err && err.message ? String(err.message) : 'Server startup failed',
      error_code: (err && (err.code || err.name)) || 'STARTUP_FAILED',
      hint_arabic:
        'افتحي Vercel → Settings → Environment Variables وتأكدي من وجود (DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production) كلهم موجودين ومفعلين على Production',
      hint:
        'Go to Vercel Dashboard → Settings → Environment Variables and confirm these 4 are set for Production: DATABASE_URL + JWT_SECRET + JWT_REFRESH_SECRET + NODE_ENV=production',
      stack: process.env.NODE_ENV === 'production' ? undefined : err && err.stack,
      timestamp: new Date().toISOString(),
    });
    return;
  }
};
