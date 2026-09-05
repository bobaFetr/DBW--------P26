const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadModule() {
  const sourcePath = path.join(__dirname, "..", "..", "components", "publicContentMerge.js");
  const source = fs.readFileSync(sourcePath, "utf8").replaceAll("export function ", "function ");
  const context = { module: { exports: {} }, exports: {} };

  vm.runInNewContext(
    `${source}\nmodule.exports = { mergeTemporaryWithLocal };`,
    context,
    { filename: sourcePath }
  );

  return context.module.exports;
}

test("local admin albums appear alongside temporary albums without ID collisions", () => {
  const { mergeTemporaryWithLocal } = loadModule();
  const result = mergeTemporaryWithLocal(
    "albums",
    [{ albumId: 1, title: "Temporary album" }],
    [{ albumId: 1, title: "Admin album" }]
  );

  assert.equal(result.length, 2);
  assert.equal(result[0].albumId, 1);
  assert.equal(result[1].albumId, "local-1");
  assert.equal(result[1].title, "Admin album");
});
