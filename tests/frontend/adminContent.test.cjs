const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../../components/adminContent.js"), "utf8");
const context = { module: { exports: {} } };
vm.runInNewContext(source.replace("export async function", "async function") +
  "\nmodule.exports = { loadPublicContent };", context);
const { loadPublicContent } = context.module.exports;
const collections = [{ key: "news", label: "News" }, { key: "albums", label: "Albums" }];

test("refreshing unchanged content keeps the same complete total", async () => {
  const fetchRows = async (key) => key === "news" ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }];
  for (let refresh = 0; refresh < 3; refresh++) {
    const result = await loadPublicContent(collections, fetchRows);
    assert.equal(result.count, 3);
    assert.equal(result.failures.length, 0);
  }
});

test("a failed collection never produces a misleading partial count", async () => {
  const result = await loadPublicContent(collections, async (key) => {
    if (key === "albums") throw new Error("HTTP 429");
    return [{ id: 1 }];
  });
  assert.equal(result.count, null);
  assert.equal(result.records.news.length, 1);
  assert.equal(result.records.albums, undefined);
  assert.equal(result.failures.join(", "), "Albums");
});

test("invalid collection responses are unavailable, while empty collections count as zero", async () => {
  const invalid = await loadPublicContent(collections, async () => ({}));
  assert.equal(invalid.count, null);
  assert.equal(invalid.failures.length, 2);
  const empty = await loadPublicContent(collections, async () => []);
  assert.equal(empty.count, 0);
});

test("a successful refresh recovers after all requests fail", async () => {
  const failed = await loadPublicContent(collections, async () => { throw new Error("Offline"); });
  assert.equal(failed.count, null);
  const recovered = await loadPublicContent(collections, async () => [{ id: 1 }]);
  assert.equal(recovered.count, 2);
});
