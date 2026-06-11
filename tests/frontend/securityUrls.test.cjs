const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadSecurityUrlModule(apiBase = "http://localhost:5001") {
  const sourcePath = path.join(__dirname, "..", "..", "components", "securityUrls.js");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replaceAll("export function ", "function ");

  const context = {
    module: { exports: {} },
    exports: {},
    process: {
      env: {
        NEXT_PUBLIC_API_BASE_URL: apiBase
      }
    },
    URL
  };

  vm.runInNewContext(
    `${source}\nmodule.exports = { safeExternalUrl, safeImageUrl, safeMediaUrl, isVideoUrl };`,
    context,
    { filename: sourcePath }
  );

  return context.module.exports;
}

test("safeExternalUrl accepts web and mail links", () => {
  const { safeExternalUrl } = loadSecurityUrlModule();

  assert.equal(safeExternalUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(safeExternalUrl("http://example.com/path"), "http://example.com/path");
  assert.equal(safeExternalUrl("mailto:band@example.com"), "mailto:band@example.com");
});

test("safeExternalUrl upgrades bare domains and rejects unsafe schemes", () => {
  const { safeExternalUrl } = loadSecurityUrlModule();

  assert.equal(safeExternalUrl("example.com"), "https://example.com/");
  assert.equal(safeExternalUrl("javascript:alert(1)"), undefined);
  assert.equal(safeExternalUrl("data:text/html,hello"), undefined);
  assert.equal(safeExternalUrl("   "), undefined);
});

test("safeImageUrl resolves uploaded assets against the API base", () => {
  const { safeImageUrl } = loadSecurityUrlModule("https://api.example.com/");

  assert.equal(
    safeImageUrl("/uploads/images/poster.png"),
    "https://api.example.com/uploads/images/poster.png"
  );
  assert.equal(safeImageUrl("/BUntitled.png"), "/BUntitled.png");
});

test("safeMediaUrl accepts database-stored video data URLs", () => {
  const { isVideoUrl, safeMediaUrl } = loadSecurityUrlModule("https://api.example.com/");
  const videoDataUrl = "data:video/mp4;base64,AQIDBA==";

  assert.equal(safeMediaUrl(videoDataUrl), videoDataUrl);
  assert.equal(isVideoUrl(videoDataUrl), true);
  assert.equal(isVideoUrl("https://example.com/live.webm"), true);
});

test("safeImageUrl accepts only safe image URL forms", () => {
  const { safeImageUrl } = loadSecurityUrlModule();

  assert.equal(safeImageUrl("https://example.com/poster.png"), "https://example.com/poster.png");
  assert.equal(safeImageUrl("http://example.com/poster.png"), "http://example.com/poster.png");
  assert.equal(safeImageUrl("data:image/jpeg;base64,AQIDBA=="), "data:image/jpeg;base64,AQIDBA==");
  assert.equal(safeImageUrl("javascript:alert(1)"), undefined);
  assert.equal(safeImageUrl("data:text/html;base64,AQIDBA=="), undefined);
  assert.equal(safeImageUrl("data:image/svg+xml;base64,AQIDBA=="), undefined);
  assert.equal(safeImageUrl("/images/poster.png"), undefined);
  assert.equal(safeImageUrl("example.com/poster.png"), undefined);
});

test("safeMediaUrl rejects unsafe video URL forms", () => {
  const { safeMediaUrl } = loadSecurityUrlModule();

  assert.equal(safeMediaUrl("/uploads/videos/live.mp4"), undefined);
  assert.equal(safeMediaUrl("/videos/live.mp4"), undefined);
  assert.equal(safeMediaUrl("data:video/mp4;base64,not-base64!"), undefined);
  assert.equal(safeMediaUrl("javascript:alert(1)"), undefined);
});
