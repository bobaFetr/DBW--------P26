const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const context = { module: { exports: {} } };
const source = fs.readFileSync(path.join(__dirname, "../../components/adminReadFetch.js"), "utf8");
vm.runInNewContext(source.replace("export async function", "async function") + "\nmodule.exports = adminReadFetch;", context);
const read = context.module.exports;
const response = (status, retryAfter = null) => ({ status, headers: { get: () => retryAfter } });

test("rate limited reads wait for Retry-After and recover automatically", async () => {
  const delays = [];
  let calls = 0;
  const result = await read("/content", {}, async () => response(++calls === 1 ? 429 : 200, "30"), async (ms) => delays.push(ms));
  assert.equal(result.status, 200);
  assert.equal(calls, 2);
  assert.deepEqual(delays, [30000]);
});

test("rate limits without an exposed Retry-After allow a refill period with bounded retries", async () => {
  const delays = [];
  let calls = 0;
  const result = await read("/content", {}, async () => { calls++; return response(429); }, async (ms) => delays.push(ms));
  assert.equal(result.status, 429);
  assert.equal(calls, 4);
  assert.deepEqual(delays, [30000, 30000, 30000]);
});

test("mutations and authentication failures are never retried", async () => {
  for (const [method, status] of [["POST", 429], ["DELETE", 503], ["GET", 401], ["GET", 403]]) {
    let calls = 0;
    await read("/content", { method }, async () => { calls++; return response(status); }, async () => assert.fail("Unexpected retry"));
    assert.equal(calls, 1);
  }
});
