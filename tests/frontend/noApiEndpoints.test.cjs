const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");
const FRONTEND_DIRS = ["app", "components", "data"];
const FORBIDDEN_API_USAGE = [
  /\bfetch\s*\(/,
  /\baxios\b/,
  /\bXMLHttpRequest\b/,
  /\bWebSocket\s*\(/,
  /\bEventSource\s*\(/,
  /["'`]\/api\//
];

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(entryPath);
    return /\.(?:js|jsx|mjs|cjs)$/.test(entry.name) ? [entryPath] : [];
  });
}

test("frontend contains no active API endpoint usage", () => {
  const violations = FRONTEND_DIRS.flatMap((directory) =>
    sourceFiles(path.join(ROOT, directory)).flatMap((file) => {
      const source = fs.readFileSync(file, "utf8");
      return FORBIDDEN_API_USAGE.some((pattern) => pattern.test(source))
        ? [path.relative(ROOT, file)]
        : [];
    })
  );

  assert.deepEqual(violations, []);
});
