const path = require('node:path');

let app;
let initError;

function tryInit() {
  if (app || initError) return;
  try {
    const mod = require(path.join(__dirname, '..', 'dist', 'app'));
    const factory = (mod && mod.createApp) || (mod && mod.default);
    if (!factory) throw new Error('Cannot find createApp in dist/app');
    app = factory();
  } catch (err) {
    initError = err && err.message ? err.message : String(err);
    try {
      const logger = require(path.join(__dirname, '..', 'dist', 'lib', 'logger'));
      if (logger && logger.logger) logger.logger.error('Server init failed:', initError);
    } catch (_) { /* ignore */ }
  }
}

function sendError(res, status, code, message) {
  const body = JSON.stringify({
    status: 'error',
    error: { code, message },
    meta: { timestamp: new Date().toISOString() },
  });
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Length', Buffer.byteLength(body));
  res.end(body);
}

module.exports = (req, res) => {
  tryInit();

  if (initError) {
    const friendly =
      initError.includes('DATABASE_URL') || initError.includes('Invalid environment')
        ? `Configuration error. Missing env vars in Vercel dashboard. Details: ${initError}`
        : `Startup error: ${initError}`;
    return sendError(res, 500, 'STARTUP_FAILED', friendly);
  }

  let finished = false;
  const timeoutMs = 25000;
  const timer = setTimeout(() => {
    if (finished) return;
    finished = true;
    sendError(
      res,
      504,
      'TIMEOUT',
      'Request timed out inside handler. Check Neon pool & env vars.',
    );
  }, timeoutMs);

  const originalEnd = res.end.bind(res);
  res.end = function patchedEnd(...args) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    return originalEnd(...args);
  };

  app(req, res);
};
