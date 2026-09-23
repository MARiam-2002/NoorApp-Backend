const path = require("path");
const process = require("process");
const swaggerJsdoc = require("swagger-jsdoc");
const fs = require("fs");

const root = process.cwd();
const useSrc = fs.existsSync(path.join(root, "src", "routes"));
const routeDir = path.join(root, useSrc ? "src/routes" : "dist/routes");
const ext = useSrc ? ".ts" : ".js";

function walk(dir, ext, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory() && !e.isSymbolicLink()) {
      walk(full, ext, results);
      continue;
    }
    if (!e.isFile() || !full.endsWith(ext)) continue;
    results.push(full.split(path.sep).join("/"));
  }
}
const files = [];
walk(routeDir, ext, files);
console.log("[Swagger test] files=" + files.length + " ext=" + ext);

const definition = {
  openapi: "3.0.3",
  info: { title: "Noor API Test", version: "1.0.0" },
  servers: [{ url: "/api/v1" }],
};

try {
  const spec = swaggerJsdoc({
    definition,
    apis: files,
    failOnErrors: false,
    verbose: true,
  });

  const paths = spec.paths ? Object.keys(spec.paths) : [];
  const tagCounts = new Map();
  for (const p of paths) {
    for (const m of Object.keys(spec.paths[p])) {
      const op = spec.paths[p][m];
      if (!op || !Array.isArray(op.tags)) continue;
      for (const t of op.tags) {
        tagCounts.set(t, (tagCounts.get(t) || 0) + 1);
      }
    }
  }
  console.log(
    "\n=== PARSED PATHS (swagger-jsdoc result) ===\nTotal paths:",
    paths.length,
  );
  console.log("\nTags with parsed ops:");
  if (tagCounts.size === 0)
    console.log("  ⚠️  NO TAGS PARSED (parser threw everything away!)");
  for (const [t, c] of [...tagCounts.entries()].sort())
    console.log("  • " + t.padEnd(24) + " = " + c);

  // Print first N paths (overview)
  console.log("\nFirst 15 paths (method+path):");
  const plist = [];
  for (const p of paths)
    for (const m of Object.keys(spec.paths[p]))
      plist.push(m.toUpperCase() + " " + p);
  plist.slice(0, 15).forEach((x) => console.log("  ", x));
  console.log("\nTotal operations: " + plist.length);

  fs.writeFileSync("_swagger_test_output.json", JSON.stringify(spec, null, 2));
  console.log("\nWrote full spec to _swagger_test_output.json for inspection.");
} catch (e) {
  console.error("swagger-jsdoc THREW FATAL:", e.message);
  console.error(e.stack);
}
