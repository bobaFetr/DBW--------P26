const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const ROOT = path.resolve(__dirname, "../..");

function renderHeader(name) {
  const source = fs.readFileSync(path.join(ROOT, "render.yaml"), "utf8");
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(
    new RegExp(`name: ${escapedName}\\r?\\n\\s+value: "([^"]+)"`)
  );
  return match?.[1];
}

function staticHeader(name) {
  const source = fs.readFileSync(path.join(ROOT, "public", "_headers"), "utf8");
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`^\\s+${escapedName}: (.+)$`, "m"));
  return match?.[1].trim();
}

test("deployment targets use the same Content Security Policy", () => {
  assert.equal(
    renderHeader("Content-Security-Policy"),
    staticHeader("Content-Security-Policy")
  );
});

test("deployment targets enforce HTTPS with HSTS", () => {
  const expected = "max-age=31536000";
  assert.equal(renderHeader("Strict-Transport-Security"), expected);
  assert.equal(staticHeader("Strict-Transport-Security"), expected);
});

test("CSP does not allow arbitrary inline scripts or styles", () => {
  const policy = renderHeader("Content-Security-Policy");

  assert.match(policy, /(?:^|; )script-src 'self'(?:;|$)/);
  assert.match(policy, /(?:^|; )style-src 'self'(?:;|$)/);
  assert.doesNotMatch(policy, /unsafe-inline|sha256-/);
});
