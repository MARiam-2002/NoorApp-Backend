const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const SRC  = path.join(ROOT, 'src');

if (!fs.existsSync(DIST)) {
  console.error('[Noor] FATAL: dist/ missing. Run `npm run build`.');
  process.exit(1);
}

(function cleanCompiledArtifactsInSrc() {
  if (!fs.existsSync(SRC)) return;
  const EXT = new Set(['.js','.cjs','.mjs','.jsx','.js.map','.d.ts.map']);
  function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const f = path.join(dir, e.name);
      if (e.isDirectory()) { walk(f); continue; }
      if (EXT.has(path.extname(e.name))) try { fs.unlinkSync(f); } catch {}
    }
  }
  walk(SRC);
})();

require(path.join(DIST, 'load-env'));

let appPromise = null;

async function getApp() {
  if (!appPromise) {
    const { initializeApp } = require(path.join(DIST, 'app'));
    appPromise = initializeApp();
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    // Express app expects (req, res, next) - Vercel passes (req, res)
    return app(req, res, (err) => {
      if (err) throw err;
    });
  } catch (err) {
    console.error('[Vercel Handler Error]', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({
      success: false,
      message: 'Internal server error',
      code: 'INTERNAL_SERVER_ERROR',
    }));
  }
};
