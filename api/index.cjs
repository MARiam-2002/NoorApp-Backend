const path = require('node:path');

const { initializeApp } = require(path.join(__dirname, '..', 'dist', 'app'));

let appPromise = null;

function getApp() {
  if (!appPromise) {
    appPromise = initializeApp();
  }
  return appPromise;
}

module.exports = async (req, res) => {
  try {
    const app = await getApp();
    app(req, res, (err) => {
      if (err) throw err;
    });
  } catch (err) {
    console.error('[Noor API]', err);
    if (!res.headersSent) {
      res.status(500).json({
        success: false,
        message: 'Internal server error',
        code: 'INTERNAL_SERVER_ERROR',
      });
    }
  }
};
