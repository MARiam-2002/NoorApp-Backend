const path = require("node:path");
const { createApp } = require(path.join(__dirname, "..", "dist", "app.js"));

const app = createApp();

module.exports = (req, res) => app(req, res);
