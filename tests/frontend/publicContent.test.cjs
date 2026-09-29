const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const test = require("node:test");

function loader(fetch) {
  const source = fs.readFileSync(path.join(__dirname, "../../components/publicContent.js"), "utf8")
    .replace(/^import .*;\r?\n/gm, "").replaceAll("export ", "");
  const context = {
    process: { env: { NEXT_PUBLIC_CONTENT_SOURCE: "temporary", NEXT_PUBLIC_LOCAL_ADMIN_OVERLAY: "true" } },
    temporaryContent: { news: [{ newsId: "seed", publicationDate: "2020-01-01" }] },
    mergeTemporaryWithLocal: (_, temporary, local) => [...temporary, ...local], fetch
  };
  vm.createContext(context);
  vm.runInContext(source, context);
  return context.loadPublicContent;
}

test("local overlay includes records beyond the first API page and sorts the merged content", async () => {
  const calls = [];
  const load = loader(async (url) => {
    calls.push(url);
    const page = new URL(url).searchParams.get("page");
    return { ok: true, json: async () => page === "2"
      ? [{ newsId: 51, publicationDate: "2026-01-01" }]
      : Array.from({ length: 50 }, (_, i) => ({ newsId: i + 1, publicationDate: "2025-01-01" })) };
  });
  const result = await load("news");
  assert.equal(result.length, 52);
  assert.equal(result[0].newsId, 51);
  assert.equal(calls.length, 2);
});

test("failed later overlay page falls back to temporary content without a partial merge", async () => {
  let calls = 0;
  const load = loader(async () => ++calls === 1
    ? { ok: true, json: async () => Array.from({ length: 50 }, (_, newsId) => ({ newsId })) }
    : { ok: false });
  const result = await load("news");
  assert.equal(result.length, 1);
  assert.equal(result[0].newsId, "seed");
});
