const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

function loadSecurityUrlModule() {
  const sourcePath = path.join(__dirname, "..", "..", "components", "securityUrls.js");
  const source = fs
    .readFileSync(sourcePath, "utf8")
    .replaceAll("export function ", "function ");

  const context = {
    module: { exports: {} },
    exports: {},
    URL
  };

  vm.runInNewContext(
    `${source}\nmodule.exports = { safeExternalUrl, safeInternalUrl, safeImageUrl, safeMediaUrl, isVideoUrl };`,
    context,
    { filename: sourcePath }
  );

  return context.module.exports;
}

test("safeExternalUrl accepts secure web and mail links", () => {
  const { safeExternalUrl } = loadSecurityUrlModule();

  assert.equal(safeExternalUrl("https://example.com/path"), "https://example.com/path");
  assert.equal(safeExternalUrl("http://example.com/path"), undefined);
  assert.equal(safeExternalUrl("mailto:band@example.com"), "mailto:band@example.com");
});

test("safeInternalUrl accepts same-origin paths and rejects protocol-relative paths", () => {
  const { safeInternalUrl } = loadSecurityUrlModule();

  assert.equal(safeInternalUrl("/albums/?song=1#player"), "/albums/?song=1#player");
  assert.equal(safeInternalUrl("//example.com/path"), undefined);
  assert.equal(safeInternalUrl("/\\example.com/path"), undefined);
  assert.equal(safeInternalUrl("https://example.com/path"), undefined);
});

test("safeExternalUrl upgrades bare domains and rejects unsafe schemes", () => {
  const { safeExternalUrl } = loadSecurityUrlModule();

  assert.equal(safeExternalUrl("example.com"), "https://example.com/");
  assert.equal(safeExternalUrl("javascript:alert(1)"), undefined);
  assert.equal(safeExternalUrl("data:text/html,hello"), undefined);
  assert.equal(safeExternalUrl("   "), undefined);
});

test("safeImageUrl accepts only public static image paths", () => {
  const { safeImageUrl } = loadSecurityUrlModule();

  assert.equal(safeImageUrl("/uploads/images/poster.png"), undefined);
  assert.equal(safeImageUrl("/BUntitled.png"), "/BUntitled.png");
  assert.equal(
    safeImageUrl("/singles/coma-distraction-instrumental.jpg"),
    "/singles/coma-distraction-instrumental.jpg"
  );
});

test("safeMediaUrl accepts embedded video data URLs", () => {
  const { isVideoUrl, safeMediaUrl } = loadSecurityUrlModule();
  const videoDataUrl = "data:video/mp4;base64,AQIDBA==";
  const videoPath = "/api/uploads/videos/123e4567-e89b-12d3-a456-426614174000";

  assert.equal(safeMediaUrl(videoDataUrl), videoDataUrl);
  assert.equal(safeMediaUrl(videoPath), undefined);
  assert.equal(isVideoUrl(videoDataUrl), true);
  assert.equal(isVideoUrl(videoPath), false);
  assert.equal(isVideoUrl("https://example.com/live.webm"), true);
});

test("safeImageUrl accepts only static-site image URL forms", () => {
  const { safeImageUrl } = loadSecurityUrlModule();

  assert.equal(safeImageUrl("https://example.com/poster.png"), undefined);
  assert.equal(safeImageUrl("http://example.com/poster.png"), undefined);
  assert.equal(safeImageUrl("data:image/jpeg;base64,AQIDBA=="), "data:image/jpeg;base64,AQIDBA==");
  assert.equal(safeImageUrl("javascript:alert(1)"), undefined);
  assert.equal(safeImageUrl("data:text/html;base64,AQIDBA=="), undefined);
  assert.equal(safeImageUrl("data:image/svg+xml;base64,AQIDBA=="), undefined);
  assert.equal(safeImageUrl("/images/poster.png"), "/images/poster.png");
  assert.equal(safeImageUrl("/api/content/news.png"), undefined);
  assert.equal(safeImageUrl("//example.com/poster.png"), undefined);
  assert.equal(safeImageUrl("example.com/poster.png"), undefined);
});

test("safeMediaUrl rejects unsafe video URL forms", () => {
  const { safeMediaUrl } = loadSecurityUrlModule();

  assert.equal(safeMediaUrl("/uploads/videos/live.mp4"), undefined);
  assert.equal(safeMediaUrl("/api/uploads/videos/not-a-guid"), undefined);
  assert.equal(safeMediaUrl("/videos/live.mp4"), undefined);
  assert.equal(safeMediaUrl("data:video/mp4;base64,not-base64!"), undefined);
  assert.equal(safeMediaUrl("javascript:alert(1)"), undefined);
});
